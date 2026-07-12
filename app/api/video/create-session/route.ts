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

    // Check that this company has an active video add-on
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

    // Generate a unique room name
    const roomName = `telehealth-${companyUser.company_id.slice(0, 8)}-${Date.now()}`;

    // Create the Twilio Video room
    const room = await twilioClient.video.v1.rooms.create({
      uniqueName: roomName,
      type: 'group',
      recordParticipantsOnConnect: recordSession === true,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/video/webhook`,
      statusCallbackMethod: 'POST',
    });

    // Create the telehealth_sessions row
    const { data: session, error: insertError } = await supabaseAdmin
      .from('telehealth_video_sessions')
      .insert({
        company_id: companyUser.company_id,
        client_id: clientId || null,
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
