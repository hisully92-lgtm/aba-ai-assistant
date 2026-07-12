import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    const body = await request.json();
    const { telehealthSessionId, roomName } = body;

    if (!roomName) {
      return NextResponse.json({ error: 'roomName is required' }, { status: 400 });
    }

    if (telehealthSessionId) {
      const { data: session } = await supabaseAdmin
        .from('telehealth_sessions')
        .select('id, company_id, room_name')
        .eq('id', telehealthSessionId)
        .single();

      if (!session || session.company_id !== companyUser.company_id) {
        return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 });
      }
    }

    const { AccessToken } = twilio.jwt;
    const { VideoGrant } = AccessToken;

    const accessToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY_SID!,
      process.env.TWILIO_API_KEY_SECRET!,
      { identity: user.id, ttl: 14400 } // 4 hour token validity
    );

    const videoGrant = new VideoGrant({ room: roomName });
    accessToken.addGrant(videoGrant);

    if (telehealthSessionId) {
      await supabaseAdmin
        .from('telehealth_sessions')
        .update({ status: 'in_progress', actual_start: new Date().toISOString() })
        .eq('id', telehealthSessionId)
        .eq('status', 'scheduled');
    }

    return NextResponse.json({
      token: accessToken.toJwt(),
      identity: user.id,
      roomName,
    });
  } catch (error: any) {
    console.error('Video token generation error:', error);
    return NextResponse.json({ error: 'Failed to generate video token' }, { status: 500 });
  }
}
