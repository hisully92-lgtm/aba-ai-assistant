'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function TelehealthPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordSession, setRecordSession] = useState(false);

  const startSession = async () => {
    setStarting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        setStarting(false);
        return;
      }

      const res = await fetch('/api/video/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ recordSession }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(JSON.stringify(err));
      }

      const { roomName } = await res.json();
      router.push(`/dashboard/telehealth/room/${roomName}`);
    } catch (err: any) {
      console.error('Failed to start session:', err);
      setError(err.message || 'Failed to start session');
      setStarting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Telehealth</h1>
      <p className="text-gray-500 mb-6">Start a video session with a client or team member.</p>

      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="recordSession"
            checked={recordSession}
            onChange={(e) => setRecordSession(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="recordSession" className="text-sm">
            Record this session
          </label>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          onClick={startSession}
          disabled={starting}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold"
        >
          {starting ? 'Starting...' : 'Start Video Session'}
        </button>
      </div>
    </div>
  );
}
