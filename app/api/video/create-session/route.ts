import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
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
    const { clientId, scheduledStart, recordSession } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Confirm the client belongs to this company
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, company_id')
      .eq('id', clientId)
      .single();

    if (!client || client.company_id !== companyUser.company_id) {
      return NextResponse.json({ error: 'Client not found' }, { status: 403 });
    }

    // Non-admin/BCBA staff must be explicitly assigned to this client
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
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create telehealth session row:', insertError);
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }

    return NextResponse.json({
      session,
      roomName,
      roomSid: room.sid,
    });
  } catch (error: any) {
    console.error('Telehealth session creation error:', error);
    return NextResponse.json({ error: 'Failed to create telehealth session' }, { status: 500 });
  }
}
