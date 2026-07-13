import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

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

    if (!roomName || !telehealthSessionId) {
      return NextResponse.json({ error: 'roomName and telehealthSessionId are required' }, { status: 400 });
    }

    const { data: videoSession } = await supabaseAdmin
      .from('telehealth_video_sessions')
      .select('id, company_id, room_name, staff_id, client_id, status')
      .eq('id', telehealthSessionId)
      .single();

    if (!videoSession || videoSession.company_id !== companyUser.company_id || videoSession.room_name !== roomName) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 });
    }

    if (videoSession.status === 'completed' || videoSession.status === 'cancelled') {
      return NextResponse.json({ error: 'This session has ended' }, { status: 403 });
    }

    const isPrivileged = companyUser.role === 'admin' || companyUser.role === 'bcba';
    const isSessionCreator = videoSession.staff_id === user.id;

    let isAssignedToClient = false;
    if (!isPrivileged && !isSessionCreator) {
      const { data: assignment } = await supabaseAdmin
        .from('client_assignments')
        .select('id')
        .eq('client_id', videoSession.client_id)
        .eq('user_id', user.id)
        .maybeSingle();
      isAssignedToClient = !!assignment;
    }

    if (!isPrivileged && !isSessionCreator && !isAssignedToClient) {
      return NextResponse.json({ error: 'You are not authorized to join this session' }, { status: 403 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const displayName = profile?.full_name || user.email || 'Staff';
    const identity = `${user.id}::${encodeURIComponent(displayName)}::${companyUser.role}`;

    const { AccessToken } = twilio.jwt;
    const { VideoGrant } = AccessToken;

    const accessToken = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY_SID!,
      process.env.TWILIO_API_KEY_SECRET!,
      { identity, ttl: 14400 } // 4 hour token validity
    );

    const videoGrant = new VideoGrant({ room: roomName });
    accessToken.addGrant(videoGrant);

    if (videoSession.status === 'scheduled') {
      await supabaseAdmin
        .from('telehealth_video_sessions')
        .update({ status: 'in_progress', actual_start: new Date().toISOString() })
        .eq('id', telehealthSessionId)
        .eq('status', 'scheduled');
    }

    // Audit log — who joined, when, from where
    await supabaseAdmin.from('telehealth_session_audit_log').insert({
      video_session_id: videoSession.id,
      company_id: companyUser.company_id,
      actor_type: 'staff',
      actor_id: user.id,
      actor_name: displayName,
      event: 'joined',
      ip_address: getClientIp(request),
      user_agent: request.headers.get('user-agent') ?? 'unknown',
    });

    return NextResponse.json({
      token: accessToken.toJwt(),
      identity,
      roomName,
      hostUserId: videoSession.staff_id,
    });
  } catch (error: any) {
    console.error('Video token generation error:', error);
    return NextResponse.json({ error: 'Failed to generate video token' }, { status: 500 });
  }
}
