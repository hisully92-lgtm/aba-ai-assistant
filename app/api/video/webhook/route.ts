import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const event = form.get('StatusCallbackEvent')?.toString();
    const roomSid = form.get('RoomSid')?.toString();

    if (!event || !roomSid) {
      return NextResponse.json({ error: 'Missing event or RoomSid' }, { status: 400 });
    }

    const { data: videoSession } = await supabaseAdmin
      .from('telehealth_video_sessions')
      .select('id, company_id, client_id, status')
      .eq('room_sid', roomSid)
      .maybeSingle();

    if (event === 'room-ended') {
      if (videoSession && videoSession.status !== 'completed') {
        await supabaseAdmin
          .from('telehealth_video_sessions')
          .update({ status: 'completed', actual_end: new Date().toISOString() })
          .eq('id', videoSession.id);
      }
    }

    if (event === 'recording-started') {
      const recordingSid = form.get('RecordingSid')?.toString();
      if (recordingSid && videoSession) {
        await supabaseAdmin.from('telehealth_video_recordings').insert({
          video_session_id: videoSession.id,
          company_id: videoSession.company_id,
          client_id: videoSession.client_id,
          room_sid: roomSid,
          recording_sid: recordingSid,
          status: 'processing',
        });
      }
    }

    if (event === 'recording-completed') {
      const recordingSid = form.get('RecordingSid')?.toString();
      const durationRaw = form.get('RecordingDuration')?.toString();
      const duration = durationRaw ? parseInt(durationRaw, 10) : null;

      if (recordingSid) {
        const { data: existing } = await supabaseAdmin
          .from('telehealth_video_recordings')
          .select('id')
          .eq('recording_sid', recordingSid)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from('telehealth_video_recordings')
            .update({ status: 'available', duration_seconds: duration })
            .eq('id', existing.id);
        } else if (videoSession) {
          // recording-started webhook may have been missed — insert fresh
          await supabaseAdmin.from('telehealth_video_recordings').insert({
            video_session_id: videoSession.id,
            company_id: videoSession.company_id,
            client_id: videoSession.client_id,
            room_sid: roomSid,
            recording_sid: recordingSid,
            duration_seconds: duration,
            status: 'available',
          });
        }
      }
    }

    if (event === 'recording-failed') {
      const recordingSid = form.get('RecordingSid')?.toString();
      if (recordingSid) {
        await supabaseAdmin
          .from('telehealth_video_recordings')
          .update({ status: 'failed' })
          .eq('recording_sid', recordingSid);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Telehealth webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
