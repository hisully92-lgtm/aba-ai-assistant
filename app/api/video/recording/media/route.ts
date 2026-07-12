import { NextRequest, NextResponse } from 'next/server';
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
    const { recordingSid } = body;

    if (!recordingSid) {
      return NextResponse.json({ error: 'recordingSid is required' }, { status: 400 });
    }

    const { data: recording } = await supabaseAdmin
      .from('telehealth_video_recordings')
      .select('id, company_id, client_id, status, video_session_id')
      .eq('recording_sid', recordingSid)
      .single();

    if (!recording || recording.company_id !== companyUser.company_id) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    if (recording.status !== 'available') {
      return NextResponse.json({ error: 'Recording is not ready yet' }, { status: 409 });
    }

    const isPrivileged = companyUser.role === 'admin' || companyUser.role === 'bcba';
    if (!isPrivileged) {
      const { data: assignment } = await supabaseAdmin
        .from('client_assignments')
        .select('id')
        .eq('client_id', recording.client_id)
        .eq('staff_id', user.id)
        .maybeSingle();
      if (!assignment) {
        return NextResponse.json({ error: 'You are not authorized to view this recording' }, { status: 403 });
      }
    }

    // Twilio's Media resource 302-redirects to a short-lived, unauthenticated media URL
    const authString = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64');

    const twilioRes = await fetch(`https://video.twilio.com/v1/Recordings/${recordingSid}/Media`, {
      headers: { Authorization: `Basic ${authString}` },
      redirect: 'manual',
    });

    const mediaUrl = twilioRes.headers.get('location');
    if (!mediaUrl) {
      return NextResponse.json({ error: 'Could not resolve recording media' }, { status: 502 });
    }

    return NextResponse.json({ url: mediaUrl });
  } catch (error: any) {
    console.error('Recording media fetch error:', error);
    return NextResponse.json({ error: 'Failed to load recording' }, { status: 500 });
  }
}
