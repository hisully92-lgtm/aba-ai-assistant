"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Profile = { id: string; full_name: string | null; role: string | null };
type ScheduleEvent = {
  id: string;
  staff_id: string;
  title: string;
  start_datetime: string;
  end_datetime: string;
  client_id: string | null;
  location: string | null;
  type: string;
};
type Conflict = {
  id: string;
  staff_id: string;
  conflict_type: string;
  start_datetime: string;
  end_datetime: string;
  description: string | null;
  resolved: boolean;
  created_at: string;
};

const CONFLICT_TYPES = [
  { value: "double_booking", label: "Double Booking", color: "bg-red-100 text-red-700", icon: "🚨" },
  { value: "overtime", label: "Overtime / Hours Exceeded", color: "bg-orange-100 text-orange-700", icon: "⏰" },
  { value: "unavailable", label: "Staff Unavailable", color: "bg-yellow-100 text-yellow-700", icon: "🚫" },
  { value: "travel_time", label: "Insufficient Travel Time", color: "bg-blue-100 text-blue-700", icon: "🚗" },
  { value: "supervision_gap", label: "Supervision Gap", color: "bg-purple-100 text-purple-700", icon: "👁️" },
  { value: "credential_expired", label: "Credential Expired", color: "bg-gray-100 text-gray-700", icon: "📋" },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am - 7pm

export default function ScheduleConflictsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [sessions, setSessions] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterStaff, setFilterStaff] = useState("");
  const [filterResolved, setFilterResolved] = useState("unresolved");
  const [viewMode, setViewMode] = useState<"list" | "week">("list");
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    return new Date(now.setDate(diff)).toISOString().split("T")[0];
  });

  const [form, setForm] = useState({
    staff_id: "",
    conflict_type: "double_booking",
    start_datetime: "",
    end_datetime: "",
    description: "",
  });

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: profileData }, { data: conflictData }, { data: sessionData }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, role").order("full_name"),
      supabase.from("schedule_conflicts").select("*").eq("created_by", user.id).order("start_datetime", { ascending: false }),
      supabase.from("sessions").select("id, staff_id, title, start_datetime, end_datetime, client_id, location, type").eq("created_by", user.id).order("start_datetime"),
    ]);

    setProfiles(profileData ?? []);
    setConflicts(conflictData ?? []);
    setSessions((sessionData ?? []).map((s: any) => ({ ...s, title: s.title ?? "Session" })));
    setLoading(false);
  }

  async function handleSave() {
    if (!form.staff_id || !form.start_datetime || !form.end_datetime) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("schedule_conflicts").insert([{
      ...form,
      description: form.description || null,
      resolved: false,
      created_by: user.id,
    }]).select().single();

    if (data) setConflicts((prev) => [data, ...prev]);
    setForm({ staff_id: "", conflict_type: "double_booking", start_datetime: "", end_datetime: "", description: "" });
    setShowForm(false);
    setSaving(false);
  }

  async function resolveConflict(id: string) {
    await supabase.from("schedule_conflicts").update({ resolved: true }).eq("id", id);
    setConflicts((prev) => prev.map((c) => c.id === id ? { ...c, resolved: true } : c));
  }

  async function deleteConflict(id: string) {
    await supabase.from("schedule_conflicts").delete().eq("id", id);
    setConflicts((prev) => prev.filter((c) => c.id !== id));
  }

  // Auto-detect double bookings from sessions
  function detectDoubleBookings(): { staff: string; time: string; count: number }[] {
    const alerts: { staff: string; time: string; count: number }[] = [];
    const staffSessions: Record<string, ScheduleEvent[]> = {};

    sessions.forEach((s) => {
      if (!s.staff_id) return;
      staffSessions[s.staff_id] = staffSessions[s.staff_id] ?? [];
      staffSessions[s.staff_id].push(s);
    });

    Object.entries(staffSessions).forEach(([staffId, events]) => {
      events.forEach((a, i) => {
        events.slice(i + 1).forEach((b) => {
          const aStart = new Date(a.start_datetime);
          const aEnd = new Date(a.end_datetime);
          const bStart = new Date(b.start_datetime);
          const bEnd = new Date(b.end_datetime);
          if (aStart < bEnd && aEnd > bStart) {
            const staff = profiles.find((p) => p.id === staffId);
            alerts.push({
              staff: staff?.full_name ?? "Unknown",
              time: `${aStart.toLocaleDateString()} ${aStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
              count: 2,
            });
          }
        });
      });
    });

    return alerts;
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? "Unknown"]));

  let filtered = conflicts;
  if (filterStaff) filtered = filtered.filter((c) => c.staff_id === filterStaff);
  if (filterResolved === "unresolved") filtered = filtered.filter((c) => !c.resolved);
  if (filterResolved === "resolved") filtered = filtered.filter((c) => c.resolved);

  const unresolvedCount = conflicts.filter((c) => !c.resolved).length;
  const detectedDoubleBookings = detectDoubleBookings();

  function conflictStyle(type: string) {
    return CONFLICT_TYPES.find((c) => c.value === type) ?? CONFLICT_TYPES[0];
  }

  // Build week view
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(selectedWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  function getSessionsForSlot(date: Date, hour: number): ScheduleEvent[] {
    return sessions.filter((s) => {
      const start = new Date(s.start_datetime);
      return start.toDateString() === date.toDateString() && start.getHours() === hour;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Staff Scheduling & Conflicts">
        <div className="flex gap-2">
          <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
            {[{ key: "list", label: "List" }, { key: "week", label: "Week" }].map((m) => (
              <button key={m.key} onClick={() => setViewMode(m.key as any)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === m.key ? "bg-blue-600 text-white" : "text-gray-500"}`}>
                {m.label}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Flag Conflict"}
          </Button>
        </div>
      </PageHeader>

      {/* ALERTS */}
      {detectedDoubleBookings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700 mb-2">
            🚨 {detectedDoubleBookings.length} auto-detected double booking{detectedDoubleBookings.length > 1 ? "s" : ""}
          </p>
          {detectedDoubleBookings.map((alert, i) => (
            <p key={i} className="text-xs text-red-600">
              {alert.staff} — {alert.time}
            </p>
          ))}
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-red-500">{unresolvedCount}</p>
          <p className="text-xs text-gray-500 mt-1">Unresolved</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">{conflicts.filter((c) => c.resolved).length}</p>
          <p className="text-xs text-gray-500 mt-1">Resolved</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-white">
          <p className="text-2xl font-bold text-blue-600">{detectedDoubleBookings.length}</p>
          <p className="text-xs text-gray-500 mt-1">Auto-detected</p>
        </div>
      </div>

      {showForm && (
        <Section title="Flag Scheduling Conflict">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Staff Member *</label>
              <select value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select staff...</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Conflict Type *</label>
              <select value={form.conflict_type} onChange={(e) => setForm({ ...form, conflict_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {CONFLICT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Start *</label>
              <input type="datetime-local" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">End *</label>
              <input type="datetime-local" value={form.end_datetime} onChange={(e) => setForm({ ...form, end_datetime: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2} placeholder="Describe the conflict..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Conflict</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* WEEK VIEW */}
      {viewMode === "week" && (
        <Section title="Weekly Schedule">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => {
              const d = new Date(selectedWeek);
              d.setDate(d.getDate() - 7);
              setSelectedWeek(d.toISOString().split("T")[0]);
            }} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">← Prev</button>
            <p className="text-sm font-medium text-gray-700">
              Week of {new Date(selectedWeek).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
            <button onClick={() => {
              const d = new Date(selectedWeek);
              d.setDate(d.getDate() + 7);
              setSelectedWeek(d.toISOString().split("T")[0]);
            }} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">Next →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-max">
              <thead>
                <tr>
                  <th className="w-16 p-2 text-gray-400 font-medium border border-gray-100">Time</th>
                  {weekDates.map((date, i) => (
                    <th key={i} className={`p-2 font-medium border border-gray-100 ${date.toDateString() === new Date().toDateString() ? "bg-blue-50 text-blue-700" : "text-gray-600"}`}>
                      <div>{DAYS[date.getDay()].slice(0, 3)}</div>
                      <div className="text-lg font-bold">{date.getDate()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="p-2 text-gray-400 border border-gray-100 text-center">
                      {hour > 12 ? `${hour - 12}pm` : hour === 12 ? "12pm" : `${hour}am`}
                    </td>
                    {weekDates.map((date, i) => {
                      const slotSessions = getSessionsForSlot(date, hour);
                      const hasConflict = detectedDoubleBookings.length > 0 && slotSessions.length > 1;
                      return (
                        <td key={i} className={`p-1 border border-gray-100 align-top min-w-24 ${hasConflict ? "bg-red-50" : ""}`}>
                          {slotSessions.map((s) => (
                            <div key={s.id} className="bg-blue-100 text-blue-800 rounded p-1 mb-0.5 text-xs leading-tight">
                              <p className="font-medium truncate">{s.title}</p>
                            </div>
                          ))}
                          {hasConflict && (
                            <div className="bg-red-200 text-red-800 rounded p-1 text-xs font-bold">🚨 Conflict</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">All Staff</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
              {["all", "unresolved", "resolved"].map((s) => (
                <button key={s} onClick={() => setFilterResolved(s)}
                  className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${filterResolved === s ? "bg-blue-600 text-white" : "text-gray-500"}`}>
                  {s}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-400">{filtered.length} conflicts</p>
          </div>

          {loading && <p className="text-gray-400 text-sm">Loading...</p>}
          {!loading && filtered.length === 0 && (
            <Section title="No Conflicts">
              <p className="text-gray-400 text-sm">No scheduling conflicts found.</p>
            </Section>
          )}

          <div className="space-y-3">
            {filtered.map((conflict) => {
              const style = conflictStyle(conflict.conflict_type);
              return (
                <div key={conflict.id} className={`border rounded-xl p-4 bg-white ${conflict.resolved ? "border-gray-100 opacity-60" : "border-red-100"}`}>
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.color}`}>
                          {style.icon} {style.label}
                        </span>
                        <p className="font-semibold text-gray-800">{profileMap.get(conflict.staff_id)}</p>
                        {conflict.resolved && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">✓ Resolved</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(conflict.start_datetime).toLocaleString()} → {new Date(conflict.end_datetime).toLocaleString()}
                      </p>
                      {conflict.description && <p className="text-sm text-gray-600 mt-1">{conflict.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      {!conflict.resolved && (
                        <Button variant="outline" onClick={() => resolveConflict(conflict.id)}>✓ Resolve</Button>
                      )}
                      <button onClick={() => deleteConflict(conflict.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}