import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, telehealthSessionId, roomName, guestToken } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    let videoSession: any = null;
    let senderName = 'Someone';
    let senderRole = '';
    let senderUserId: string | null = null;

    const authHeader = request.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      // --- Staff path ---
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

      if (!telehealthSessionId || !roomName) {
        return NextResponse.json({ error: 'telehealthSessionId and roomName are required' }, { status: 400 });
      }

      const { data: session } = await supabaseAdmin
        .from('telehealth_video_sessions')
        .select('id, company_id, room_name, staff_id, client_id, status, group_chat_id')
        .eq('id', telehealthSessionId)
        .single();

      if (!session || session.company_id !== companyUser.company_id || session.room_name !== roomName) {
        return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 });
      }

      const isPrivileged = companyUser.role === 'admin' || companyUser.role === 'bcba';
      const isSessionCreator = session.staff_id === user.id;
      let isAssignedToClient = false;
      if (!isPrivileged && !isSessionCreator) {
        const { data: assignment } = await supabaseAdmin
          .from('client_assignments')
          .select('id')
          .eq('client_id', session.client_id)
          .eq('user_id', user.id)
          .maybeSingle();
        isAssignedToClient = !!assignment;
      }
      if (!isPrivileged && !isSessionCreator && !isAssignedToClient) {
        return NextResponse.json({ error: 'You are not authorized for this session' }, { status: 403 });
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      videoSession = session;
      senderName = profile?.full_name || user.email || 'Staff';
      senderRole = companyUser.role;
      senderUserId = user.id;
    } else if (guestToken) {
      // --- Guest path ---
      const { data: session } = await supabaseAdmin
        .from('telehealth_video_sessions')
        .select('id, status, guest_token_expires_at, client_id, group_chat_id')
        .eq('guest_token', guestToken)
        .single();

      if (!session) {
        return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 });
      }
      if (session.guest_token_expires_at && new Date(session.guest_token_expires_at) < new Date()) {
        return NextResponse.json({ error: 'This invite link has expired' }, { status: 403 });
      }
      if (session.status === 'completed' || session.status === 'cancelled') {
        return NextResponse.json({ error: 'This session has ended' }, { status: 403 });
      }

      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('guardian_name')
        .eq('id', session.client_id)
        .single();

      videoSession = session;
      senderName = client?.guardian_name || 'Guest';
      senderRole = 'guardian';
      senderUserId = null;
    } else {
      return NextResponse.json({ error: 'Missing authorization or guestToken' }, { status: 401 });
    }

    if (!videoSession.group_chat_id) {
      return NextResponse.json({ error: 'Chat is not available for this session' }, { status: 400 });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('group_chat_messages')
      .insert({
        group_chat_id: videoSession.group_chat_id,
        user_id: senderUserId,
        message: message.trim(),
        sender_name: senderName,
        sender_role: senderRole,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to send chat message:', insertError);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({ message: inserted });
  } catch (error: any) {
    console.error('Telehealth chat send error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
