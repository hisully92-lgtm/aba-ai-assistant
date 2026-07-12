import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guestToken } = body;

    if (!guestToken) {
      return NextResponse.json({ error: 'guestToken is required' }, { status: 400 });
    }

    const { data: videoSession } = await supabaseAdmin
      .from('telehealth_video_sessions')
      .select('id, room_name, status, guest_token_expires_at, client_id')
      .eq('guest_token', guestToken)
      .single();

    if (!videoSession) {
      return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 });
    }

    if (videoSession.guest_token_expires_at && new Date(videoSession.guest_token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite link has expired' }, { status: 403 });
    }

    if (videoSession.status === 'completed' || videoSession.status === 'cancelled') {
      return NextResponse.json({ error: 'This session has ended' }, { status: 403 });
    }

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('full_name')
      .eq('id', videoSession.client_id)
      .single();

    const guestIdentity = `guest-${videoSession.id.slice(0, 8)}`;

    const { AccessToken } = twilio.jwt;
    const { VideoGrant } = AccessToken;

    const accessToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY_SID!,
      process.env.TWILIO_API_KEY_SECRET!,
      { identity: guestIdentity, ttl: 14400 }
    );

    const videoGrant = new VideoGrant({ room: videoSession.room_name });
    accessToken.addGrant(videoGrant);

    return NextResponse.json({
      token: accessToken.toJwt(),
      roomName: videoSession.room_name,
      clientName: client?.full_name ?? 'your session',
    });
  } catch (error: any) {
    console.error('Guest token generation error:', error);
    return NextResponse.json({ error: 'Failed to join session' }, { status: 500 });
  }
}
