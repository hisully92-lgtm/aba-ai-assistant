"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Session = {
  id: string;
  client_id: string;
  date: string;
  status: string;
  change_type: string | null;
  change_reason: string | null;
  original_date: string | null;
  created_at: string;
};

const CHANGE_TYPES = [
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
  { value: "rescheduled_later", label: "Pushed Back", color: "bg-orange-100 text-orange-700" },
  { value: "rescheduled_earlier", label: "Pushed Up", color: "bg-blue-100 text-blue-700" },
  { value: "extended", label: "Extended", color: "bg-green-100 text-green-700" },
  { value: "shortened", label: "Shortened", color: "bg-yellow-100 text-yellow-700" },
  { value: "location_change", label: "Location Changed", color: "bg-purple-100 text-purple-700" },
];

const CANCEL_REASONS = [
  "Client illness",
  "Family emergency",
  "Staff illness",
  "School event",
  "Weather/transportation",
  "Insurance authorization issue",
  "Client behavior — unsafe",
  "No show",
  "Therapist unavailable",
  "Holiday",
  "Other",
];

export default function SessionChangesPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [filterType, setFilterType] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [changeType, setChangeType] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [originalDate, setOriginalDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: sessionData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("sessions").select("id, client_id, date, status, change_type, change_reason, original_date, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    setClients(clientData ?? []);
    setSessions(sessionData ?? []);
    setLoading(false);
  }

  async function handleSaveChange(sessionId: string) {
    if (!changeType || !changeReason) return;
    setSaving(true);

    await supabase.from("sessions").update({
      change_type: changeType,
      change_reason: changeReason,
      original_date: originalDate || null,
      status: changeType === "cancelled" ? "cancelled" : "modified",
    } as any).eq("id", sessionId);

    setSessions((prev) => prev.map((s) => s.id === sessionId ? {
      ...s,
      change_type: changeType,
      change_reason: changeReason,
      original_date: originalDate || null,
      status: changeType === "cancelled" ? "cancelled" : "modified",
    } : s));

    setEditingId(null);
    setChangeType("");
    setChangeReason("");
    setOriginalDate("");
    setSaving(false);
  }

  function startEdit(session: Session) {
    setEditingId(session.id);
    setChangeType(session.change_type ?? "");
    setChangeReason(session.change_reason ?? "");
    setOriginalDate(session.original_date ?? "");
  }

  let filtered = sessions;
  if (filterClient) filtered = filtered.filter((s) => s.client_id === filterClient);
  if (filterType) filtered = filtered.filter((s) => s.change_type === filterType);

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  function changeColor(type: string | null) {
    return CHANGE_TYPES.find((t) => t.value === type)?.color ?? "bg-gray-100 text-gray-500";
  }

  function changeLabel(type: string | null) {
    return CHANGE_TYPES.find((t) => t.value === type)?.label ?? type ?? "No change";
  }

  const changedSessions = sessions.filter((s) => s.change_type && s.change_type !== "none");
  const cancelledCount = sessions.filter((s) => s.change_type === "cancelled").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Session Changes">
        <p className="text-gray-500 text-sm">Log and track session cancellations, reschedules, and modifications.</p>
      </PageHeader>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-blue-600">{sessions.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Sessions</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-orange-500">{changedSessions.length}</p>
          <p className="text-xs text-gray-500 mt-1">Modified</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-red-500">{cancelledCount}</p>
          <p className="text-xs text-gray-500 mt-1">Cancelled</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">
            {sessions.length ? Math.round(((sessions.length - cancelledCount) / sessions.length) * 100) : 0}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Attendance Rate</p>
        </div>
      </div>

      {/* FILTERS */}
      {!loading && sessions.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Changes</option>
            {CHANGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} sessions</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Sessions">
          <p className="text-gray-400 text-sm">No sessions found.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((session) => {
          const isEditing = editingId === session.id;
          return (
            <div key={session.id} className={`border rounded-xl bg-white ${session.change_type === "cancelled" ? "border-red-200" : session.change_type && session.change_type !== "none" ? "border-orange-200" : "border-gray-100"}`}>
              <div className="p-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <p className="font-semibold text-gray-800">{clientMap.get(session.client_id) ?? "Unknown"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {session.date ?? new Date(session.created_at).toLocaleDateString()} · {session.status}
                      {session.original_date && ` · Originally: ${session.original_date}`}
                    </p>
                    {session.change_type && session.change_type !== "none" && (
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${changeColor(session.change_type)}`}>
                          {changeLabel(session.change_type)}
                        </span>
                        {session.change_reason && (
                          <span className="text-xs text-gray-500">Reason: {session.change_reason}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => isEditing ? setEditingId(null) : startEdit(session)}>
                    {isEditing ? "Cancel" : "Log Change"}
                  </Button>
                </div>

                {isEditing && (
                  <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Change Type *</label>
                      <div className="flex flex-wrap gap-2">
                        {CHANGE_TYPES.map((t) => (
                          <button key={t.value} onClick={() => setChangeType(t.value)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${changeType === t.value ? t.color + " border-current" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(changeType === "rescheduled_later" || changeType === "rescheduled_earlier") && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Original Date</label>
                        <input type="date" value={originalDate} onChange={(e) => setOriginalDate(e.target.value)}
                          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Reason *</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {CANCEL_REASONS.map((r) => (
                          <button key={r} onClick={() => setChangeReason(r)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${changeReason === r ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                      <input type="text" value={changeReason} onChange={(e) => setChangeReason(e.target.value)}
                        placeholder="Or type custom reason..."
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <Button onClick={() => handleSaveChange(session.id)} loading={saving}
                      disabled={!changeType || !changeReason}>
                      Save Change
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}