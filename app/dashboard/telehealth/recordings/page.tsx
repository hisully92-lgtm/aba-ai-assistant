'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Recording = {
  id: string;
  recording_sid: string;
  duration_seconds: number | null;
  status: string;
  consent_obtained: boolean;
  created_at: string;
  client_id: string;
  clients?: { full_name: string } | null;
};

export default function TelehealthRecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!companyUser) {
      setLoading(false);
      return;
    }

    const isPrivileged = companyUser.role === 'admin' || companyUser.role === 'bcba';

    let query = supabase
      .from('telehealth_video_recordings')
      .select('id, recording_sid, duration_seconds, status, consent_obtained, created_at, client_id, clients(full_name)')
      .eq('company_id', companyUser.company_id)
      .order('created_at', { ascending: false });

    if (!isPrivileged) {
      const { data: assignments } = await supabase
        .from('client_assignments')
        .select('client_id')
        .eq('staff_id', user.id);
      const clientIds = (assignments ?? []).map((a: { client_id: string }) => a.client_id);
      if (clientIds.length === 0) {
        setRecordings([]);
        setLoading(false);
        return;
      }
      query = query.in('client_id', clientIds);
    }

    const { data } = await query;
    setRecordings((data as any) ?? []);
    setLoading(false);
  }

  async function play(recordingSid: string) {
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/video/recording/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ recordingSid }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || 'Failed to load recording');
      return;
    }

    const { url } = await res.json();
    setPlayingUrl(url);
  }

  async function toggleConsent(id: string, current: boolean) {
    await supabase.from('telehealth_video_recordings').update({ consent_obtained: !current }).eq('id', id);
    setRecordings((prev) => prev.map((r) => (r.id === id ? { ...r, consent_obtained: !current } : r)));
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function statusColor(status: string) {
    if (status === 'available') return 'bg-green-100 text-green-700';
    if (status === 'processing') return 'bg-yellow-100 text-yellow-700';
    if (status === 'failed') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-500';
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Telehealth Recordings</h1>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-700 space-y-1">
        <p className="font-bold mb-1">⚖️ Recording requires informed consent</p>
        <p>Confirm consent was obtained from the client/guardian before treating a recording as available for review. Consent laws vary by state.</p>
      </div>

      {playingUrl && (
        <div className="bg-black rounded-xl overflow-hidden">
          <video src={playingUrl} controls autoPlay className="w-full" />
          <button
            onClick={() => setPlayingUrl(null)}
            className="w-full py-2 bg-gray-800 text-white text-sm"
          >
            Close
          </button>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {!loading && recordings.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">No recordings yet.</div>
      )}

      <div className="space-y-3">
        {recordings.map((rec) => (
          <div key={rec.id} className={`border rounded-xl p-4 bg-white ${!rec.consent_obtained ? 'border-orange-200' : 'border-gray-100'}`}>
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-medium text-gray-800">{rec.clients?.full_name ?? 'Unknown client'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(rec.created_at).toLocaleDateString()} · {formatDuration(rec.duration_seconds)}
                </p>
                {!rec.consent_obtained && (
                  <p className="text-xs text-red-600 mt-0.5 font-medium">⚠️ Consent not documented</p>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(rec.status)}`}>
                  {rec.status}
                </span>
                <button
                  onClick={() => toggleConsent(rec.id, rec.consent_obtained)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${rec.consent_obtained ? 'border-green-300 text-green-600 bg-green-50' : 'border-orange-300 text-orange-600'}`}
                >
                  {rec.consent_obtained ? '✓ Consent' : 'Add Consent'}
                </button>
                {rec.status === 'available' && (
                  <button
                    onClick={() => play(rec.recording_sid)}
                    className="text-xs px-3 py-1.5 rounded-full bg-blue-600 text-white"
                  >
                    ▶ Play
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
