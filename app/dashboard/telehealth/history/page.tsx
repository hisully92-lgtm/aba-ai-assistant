'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type SessionRow = {
  id: string;
  client_id: string;
  client_name: string;
  status: string;
  scheduled_start: string | null;
  actual_start: string | null;
  actual_end: string | null;
  my_joined_at: string | null;
  participants: { name: string; role: string }[];
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  bcba: 'BCBA',
  rbt: 'RBT',
  guardian: 'Guardian',
  clinician: 'Clinician',
  supervisor: 'Supervisor',
  staff: 'Staff',
  system: 'System',
};

export default function TelehealthHistoryPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    // Sessions this person joined (from the audit log) or personally created
    const { data: joinedRows } = await supabase
      .from('telehealth_session_audit_log')
      .select('video_session_id')
      .eq('actor_id', user.id)
      .eq('event', 'joined');

    const joinedSessionIds = Array.from(new Set((joinedRows ?? []).map((r: { video_session_id: string }) => r.video_session_id)));

    const { data: createdSessions } = await supabase
      .from('telehealth_video_sessions')
      .select('id')
      .eq('staff_id', user.id);

    const allSessionIds = Array.from(
      new Set([...joinedSessionIds, ...((createdSessions ?? []).map((s: { id: string }) => s.id))])
    );

    if (allSessionIds.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase
      .from('telehealth_video_sessions')
      .select('id, client_id, status, scheduled_start, actual_start, actual_end, clients(full_name)')
      .in('id', allSessionIds)
      .order('scheduled_start', { ascending: false });

    const { data: auditData } = await supabase
      .from('telehealth_session_audit_log')
      .select('video_session_id, actor_name, actor_type, event, created_at')
      .in('video_session_id', allSessionIds)
      .eq('event', 'joined')
      .order('created_at', { ascending: true });

    const participantsBySession = new Map<string, { name: string; role: string }[]>();
    const myJoinedAtBySession = new Map<string, string>();
    (auditData ?? []).forEach((row: any) => {
      const list = participantsBySession.get(row.video_session_id) ?? [];
      list.push({ name: row.actor_name ?? 'Unknown', role: row.actor_type ?? '' });
      participantsBySession.set(row.video_session_id, list);

      if (row.actor_id === user.id && !myJoinedAtBySession.has(row.video_session_id)) {
        myJoinedAtBySession.set(row.video_session_id, row.created_at);
      }
    });

    const rows: SessionRow[] = (sessionData ?? []).map((s: any) => ({
      id: s.id,
      client_id: s.client_id,
      client_name: s.clients?.full_name ?? 'Unknown client',
      status: s.status,
      scheduled_start: s.scheduled_start,
      actual_start: s.actual_start,
      actual_end: s.actual_end,
      my_joined_at: myJoinedAtBySession.get(s.id) ?? s.actual_start ?? null,
      participants: participantsBySession.get(s.id) ?? [],
    }));

    setSessions(rows);
    setLoading(false);
  }

  function formatDuration(start: string | null, end: string | null): string {
    if (!start || !end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms <= 0) return '—';
    const mins = Math.round(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function statusColor(status: string) {
    if (status === 'completed') return 'bg-green-100 text-green-700';
    if (status === 'in_progress') return 'bg-blue-100 text-blue-700';
    if (status === 'cancelled') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-500';
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Telehealth Session History</h1>
        <p className="text-gray-500 text-sm mt-1">A log of the telehealth sessions you've been part of.</p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {!loading && sessions.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">No telehealth sessions yet.</div>
      )}

      <div className="space-y-3">
        {sessions.map((s) => (
          <div key={s.id} className="border border-gray-200 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
              <div>
                <p className="font-semibold text-gray-800">{s.client_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {s.scheduled_start ? new Date(s.scheduled_start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unknown'}
                  {' · You: '}
                  {formatTime(s.my_joined_at)} – {formatTime(s.actual_end)}
                  {' · '}
                  {formatDuration(s.my_joined_at, s.actual_end)}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(s.status)}`}>
                {s.status.replace('_', ' ')}
              </span>
            </div>

            {s.participants.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Also in this session</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.participants
                    .filter((p) => p.name)
                    .map((p, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                        {p.name}{p.role ? ` · ${ROLE_LABELS[p.role] ?? p.role}` : ''}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center pt-2">
        Duration reflects your own time in each session, from when you joined to when the session ended.
      </p>
    </div>
  );
}


