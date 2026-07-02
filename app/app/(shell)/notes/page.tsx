"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/app/AppShell";

type Client = { id: string; full_name: string };
type SessionNote = {
  id: string;
  client_id: string;
  session_date: string;
  note: string | null;
  created_at: string;
};

export default function NotesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [clientId, setClientId] = useState("");
  const [noteText, setNoteText] = useState("");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: companyUser } = await supabase.from("company_users").select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();

    const [{ data: clientData }, { data: noteData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("company_id", companyUser?.company_id),
      supabase.from("session_notes").select("id, client_id, session_date, note, created_at").eq("rbt_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);

    setClients(clientData ?? []);
    setSessionNotes(noteData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!clientId || !noteText.trim()) {
      alert("Please select a client and add notes.");
      return;
    }
    setSaving(true);
    const { data } = await supabase.from("session_notes").insert({
      client_id: clientId,
      session_date: new Date().toISOString().split("T")[0],
      note: noteText.trim(),
      rbt_id: userId,
    }).select().single();
    if (data) setSessionNotes(prev => [data, ...prev]);
    setNoteText("");
    setClientId("");
    setShowForm(false);
    setSaving(false);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));

  if (loading) {
    return <AppShell title="Session Notes"><div className="flex justify-center py-20"><p className="text-gray-400 text-sm">Loading...</p></div></AppShell>;
  }

  return (
    <AppShell title="Session Notes">
      <div className="pb-10">
        <button onClick={() => setShowForm(s => !s)} className="block mx-4 mt-4 mb-2 text-white font-bold py-3.5 rounded-xl text-center" style={{ backgroundColor: "#2563eb", width: "calc(100% - 2rem)" }}>
          {showForm ? "✕ Cancel" : "+ New Note"}
        </button>

        {showForm && (
          <div className="mx-4 bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-base font-bold text-gray-900 mb-4">New Session Note</p>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Client</p>
            <div className="flex gap-2 overflow-x-auto pb-1 mb-3.5">
              {clients.map(c => (
                <button key={c.id} onClick={() => setClientId(c.id)}
                  className="px-3.5 py-2 rounded-full border text-[13px] whitespace-nowrap"
                  style={clientId === c.id ? { backgroundColor: "#2563eb", borderColor: "#2563eb", color: "#fff", fontWeight: 600 } : { borderColor: "#d1d5db", color: "#374151", backgroundColor: "#f9fafb" }}>
                  {c.full_name}
                </button>
              ))}
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write session notes here..."
              className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-900 bg-gray-50 mb-3.5" style={{ minHeight: 120 }} />

            <button onClick={handleSave} disabled={!clientId || !noteText.trim() || saving}
              className="w-full text-white font-bold py-3.5 rounded-xl disabled:opacity-60" style={{ backgroundColor: !clientId || !noteText.trim() ? "#93c5fd" : "#2563eb" }}>
              {saving ? "..." : "Save Note"}
            </button>
          </div>
        )}

        <div className="p-4">
          <p className="text-[15px] font-bold text-gray-900 mb-3">Recent Notes</p>

          {sessionNotes.length === 0 && (
            <div className="flex flex-col items-center py-10">
              <p className="text-4xl mb-2.5">📝</p>
              <p className="text-sm text-gray-400">No notes yet. Tap + New Note to add one.</p>
            </div>
          )}

          {sessionNotes.map(n => (
            <div key={n.id} className="bg-white rounded-xl p-3.5 mb-2.5 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-gray-900">{clientMap.get(n.client_id) ?? "Unknown"}</span>
                <span className="text-xs text-gray-400">{n.session_date ?? new Date(n.created_at).toLocaleDateString()}</span>
              </div>
              {n.note && <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-4">{n.note}</p>}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
