import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

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
    const form = (await request.formData()) as unknown as { get: (key: string) => { toString(): string } | null };
    const event = form.get('StatusCallbackEvent')?.toString();
    const roomSid = form.get('RoomSid')?.toString();

    if (!event || !roomSid) {
      return NextResponse.json({ error: 'Missing event or RoomSid' }, { status: 400 });
    }

    const { data: videoSession } = await supabaseAdmin
      .from('telehealth_video_sessions')
      .select('id, company_id, client_id, status, scheduled_start, actual_start')
      .eq('room_sid', roomSid)
      .maybeSingle();

    // Whenever someone leaves, check if the room is now empty — if so, end it
    // immediately rather than waiting on Twilio's default ~5 minute empty-room timeout.
    if (event === 'participant-disconnected' && videoSession && videoSession.status === 'in_progress') {
      try {
        const connectedParticipants = await twilioClient.video.v1
          .rooms(roomSid)
          .participants.list({ status: 'connected' });

        if (connectedParticipants.length === 0) {
          await twilioClient.video.v1.rooms(roomSid).update({ status: 'completed' });
          // Twilio will fire its own 'room-ended' webhook after this, which handles
          // marking the session completed and logging usage — no need to duplicate that here.
        }
      } catch (err) {
        console.log(`Could not check/end empty room ${roomSid}:`, err);
      }
    }

    if (event === 'room-ended') {
      if (videoSession && videoSession.status !== 'completed') {
        const now = new Date();
        await supabaseAdmin
          .from('telehealth_video_sessions')
          .update({ status: 'completed', actual_end: now.toISOString() })
          .eq('id', videoSession.id);

        // Log participant-minute usage for billing (Phase 8).
        // Approximation: room duration from Twilio, not summed per-participant —
        // close enough for 1:1 and small-group sessions, which covers this use case.
        const roomDurationRaw = form.get('RoomDuration')?.toString();
        const durationSeconds = roomDurationRaw ? parseInt(roomDurationRaw, 10) : null;
        const start = videoSession.actual_start ? new Date(videoSession.actual_start) : null;
        const minutesUsed = durationSeconds
          ? Math.max(1, Math.round(durationSeconds / 60))
          : start
          ? Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000))
          : null;

        if (minutesUsed) {
          await supabaseAdmin.from('addon_usage_log').insert({
            company_id: videoSession.company_id,
            addon_type: 'video',
            units_used: minutesUsed,
            source_id: videoSession.id,
            period_start: start?.toISOString() ?? now.toISOString(),
            period_end: now.toISOString(),
          });
        }
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
