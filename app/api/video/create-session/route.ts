import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: companyUser } = await supabaseAdmin
      .from('company_users')
      .select('company_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!companyUser) {
      return NextResponse.json({ error: 'No active company membership' }, { status: 403 });
    }

    const { data: addon } = await supabaseAdmin
      .from('company_addons')
      .select('status')
      .eq('company_id', companyUser.company_id)
      .eq('addon_type', 'video')
      .single();

    if (!addon || addon.status !== 'active') {
      return NextResponse.json(
        { error: 'Telehealth video is not active for your company. Request it from Plans & Billing.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { clientId, scheduledStart, recordSession, inviteGuardian } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, company_id, full_name, guardian_name, guardian_phone')
      .eq('id', clientId)
      .single();

    if (!client || client.company_id !== companyUser.company_id) {
      return NextResponse.json({ error: 'Client not found' }, { status: 403 });
    }

    const isPrivileged = companyUser.role === 'admin' || companyUser.role === 'bcba';
    if (!isPrivileged) {
      const { data: assignment } = await supabaseAdmin
        .from('client_assignments')
        .select('id')
        .eq('client_id', clientId)
        .eq('staff_id', user.id)
        .maybeSingle();

      if (!assignment) {
        return NextResponse.json({ error: 'You are not assigned to this client' }, { status: 403 });
      }
    }

    const roomName = `telehealth-${companyUser.company_id.slice(0, 8)}-${Date.now()}`;
    const guestToken = crypto.randomBytes(24).toString('hex');
    const guestTokenExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hour window

    const room = await twilioClient.video.v1.rooms.create({
      uniqueName: roomName,
      type: 'group',
      recordParticipantsOnConnect: recordSession === true,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/video/webhook`,
      statusCallbackMethod: 'POST',
    });

    const { data: session, error: insertError } = await supabaseAdmin
      .from('telehealth_video_sessions')
      .insert({
        company_id: companyUser.company_id,
        client_id: clientId,
        staff_id: user.id,
        room_name: roomName,
        room_sid: room.sid,
        status: 'scheduled',
        scheduled_start: scheduledStart || new Date().toISOString(),
        guest_token: guestToken,
        guest_token_expires_at: guestTokenExpiresAt,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create telehealth session row:', insertError);
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }

    // Text the guardian a no-login join link, if requested and a number is on file
    let smsResult: 'sent' | 'skipped' | 'failed' = 'skipped';
    if (inviteGuardian !== false && client.guardian_phone) {
      const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL}/telehealth/join/${guestToken}`;
      const message = `${client.guardian_name ? client.guardian_name + ', ' : ''}your ABA AI telehealth session for ${client.full_name} is ready. Join here: ${joinUrl}`;

      try {
        const smsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sms/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: client.guardian_phone,
            message,
            companyId: companyUser.company_id,
            triggerType: 'telehealth_invite',
          }),
        });
        smsResult = smsRes.ok ? 'sent' : 'failed';
      } catch (err) {
        console.error('Guardian SMS invite failed:', err);
        smsResult = 'failed';
      }
    }

    return NextResponse.json({
      session,
      roomName,
      roomSid: room.sid,
      guardianInvite: smsResult,
    });
  } catch (error: any) {
    console.error('Telehealth session creation error:', error);
    return NextResponse.json({ error: 'Failed to create telehealth session' }, { status: 500 });
  }
}
