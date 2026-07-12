import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telehealthSessionId, roomName, guestToken } = body;

    let groupChatId: string | null = null;
    const authHeader = request.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
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
        .select('id, company_id, room_name, staff_id, client_id, group_chat_id')
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
          .eq('staff_id', user.id)
          .maybeSingle();
        isAssignedToClient = !!assignment;
      }
      if (!isPrivileged && !isSessionCreator && !isAssignedToClient) {
        return NextResponse.json({ error: 'You are not authorized for this session' }, { status: 403 });
      }

      groupChatId = session.group_chat_id;
    } else if (guestToken) {
      const { data: session } = await supabaseAdmin
        .from('telehealth_video_sessions')
        .select('id, guest_token_expires_at, status, group_chat_id')
        .eq('guest_token', guestToken)
        .single();

      if (!session) {
        return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 });
      }
      if (session.guest_token_expires_at && new Date(session.guest_token_expires_at) < new Date()) {
        return NextResponse.json({ error: 'This invite link has expired' }, { status: 403 });
      }

      groupChatId = session.group_chat_id;
    } else {
      return NextResponse.json({ error: 'Missing authorization or guestToken' }, { status: 401 });
    }

    if (!groupChatId) {
      return NextResponse.json({ messages: [] });
    }

    const { data: messages } = await supabaseAdmin
      .from('group_chat_messages')
      .select('id, message, sender_name, sender_role, created_at')
      .eq('group_chat_id', groupChatId)
      .order('created_at', { ascending: true })
      .limit(200);

    return NextResponse.json({ messages: messages ?? [] });
  } catch (error: any) {
    console.error('Telehealth chat list error:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}
