'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type Client = { id: string; full_name: string };
type ActiveSession = { id: string; room_name: string; staff_id: string; status: string };

export default function TelehealthPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordSession, setRecordSession] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [checkingActive, setCheckingActive] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (!clientId) {
      setActiveSession(null);
      return;
    }
    checkActiveSession(clientId);
  }, [clientId]);

  async function loadClients() {
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

    if (isPrivileged) {
      const { data } = await supabase
        .from('clients')
        .select('id, full_name')
        .eq('company_id', companyUser.company_id)
        .order('full_name');
      setClients(data ?? []);
    } else {
      const { data } = await supabase
        .from('client_assignments')
        .select('client_id, clients(id, full_name)')
        .eq('user_id', user.id);
      const assigned = (data ?? [])
        .map((row: any) => row.clients)
        .filter(Boolean)
        .sort((a: Client, b: Client) => a.full_name.localeCompare(b.full_name));
      setClients(assigned);
    }

    setLoading(false);
  }

  async function checkActiveSession(selectedClientId: string) {
    setCheckingActive(true);
    setActiveSession(null);
    const { data } = await supabase
      .from('telehealth_video_sessions')
      .select('id, room_name, staff_id, status')
      .eq('client_id', selectedClientId)
      .in('status', ['scheduled', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveSession(data ?? null);
    setCheckingActive(false);
  }

  const joinExisting = () => {
    if (!activeSession) return;
    router.push(`/dashboard/telehealth/room/${activeSession.room_name}?sessionId=${activeSession.id}`);
  };

  const startSession = async () => {
    if (!clientId) {
      setError('Select a client to start a session');
      return;
    }

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
        body: JSON.stringify({ clientId, recordSession }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start session');
      }

      const { roomName, session: createdSession } = await res.json();
      router.push(`/dashboard/telehealth/room/${roomName}?sessionId=${createdSession.id}`);
    } catch (err: any) {
      console.error('Failed to start session:', err);
      setError(err.message || 'Failed to start session');
      setStarting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-start mb-2"><h1 className="text-2xl font-bold">Telehealth</h1><a href="/dashboard/telehealth/history" className="text-sm text-blue-600 hover:underline">View Session History ?</a></div>
      <p className="text-gray-500 mb-6">Start a video session with a client.</p>

      <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
        <div>
          <label htmlFor="clientId" className="text-sm font-medium text-gray-700 mb-1 block">
            Client *
          </label>
          <select
            id="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={loading}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">
              {loading ? 'Loading clients...' : clients.length === 0 ? 'No assigned clients' : 'Select client...'}
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
        </div>

        {checkingActive && (
          <p className="text-xs text-gray-400">Checking for an active session...</p>
        )}

        {activeSession && !checkingActive && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="text-sm text-blue-800 font-medium">
              A telehealth session for this client is already {activeSession.status === 'in_progress' ? 'in progress' : 'scheduled'}.
            </p>
            <button
              onClick={joinExisting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
            >
              Join Existing Session
            </button>
          </div>
        )}

        {!activeSession && !checkingActive && (
          <>
            <div className="flex items-center gap-2">
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

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              onClick={startSession}
              disabled={starting || loading || !clientId}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold"
            >
              {starting ? 'Starting...' : 'Start Video Session'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

