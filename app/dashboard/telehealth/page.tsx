'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type Client = { id: string; full_name: string };

export default function TelehealthPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordSession, setRecordSession] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

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
        .eq('staff_id', user.id);
      const assigned = (data ?? [])
        .map((row: any) => row.clients)
        .filter(Boolean)
        .sort((a: Client, b: Client) => a.full_name.localeCompare(b.full_name));
      setClients(assigned);
    }

    setLoading(false);
  }

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
      <h1 className="text-2xl font-bold mb-2">Telehealth</h1>
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
      </div>
    </div>
  );
}
