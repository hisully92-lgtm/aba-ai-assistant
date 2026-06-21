"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";

type ScheduleEntry = {
  id: string; company_id: string; assigned_to: string | null;
  client_id: string | null; client_initials: string;
  date: string; start_time: string | null; end_time: string | null;
  session_type: string; is_telehealth: boolean;
  address: string | null; telehealth_link: string | null;
  bcba_name: string | null; status: string; created_by: string;
};

type Client = { id: string; full_name: string };
type Profile = { id: string; full_name: string | null; role: string | null };

const SESSION_TYPES = [
  "ABA Therapy", "Supervision", "Team Meeting", "Parent Training",
  "Telehealth", "Assessment", "Consultation", "Staff Training",
  "IEP Meeting", "Caregiver Training", "Peer Play", "Other",
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
  rescheduled: "bg-yellow-100 text-yellow-700",
};

const SESSION_COLORS: Record<string, string> = {
  "ABA Therapy": "#3b82f6",
  "Supervision": "#7c3aed",
  "Team Meeting": "#0891b2",
  "Parent Training": "#16a34a",
  "Telehealth": "#2563eb",
  "Assessment": "#d97706",
  "Consultation": "#6b7280",
  "Staff Training": "#ec4899",
  "IEP Meeting": "#dc2626",
  "Caregiver Training": "#059669",
  "Peer Play": "#f59e0b",
  "Other": "#9ca3af",
};

type ViewMode = "day" | "week" | "month" | "list";

const emptyForm = {
  client_id: "", client_initials: "", date: new Date().toISOString().split("T")[0],
  start_time: "", end_time: "", session_type: "ABA Therapy",
  is_telehealth: false, address: "", telehealth_link: "",
  bcba_name: "", status: "scheduled", assigned_to: "",
};

export default function SchedulePage() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: cu } = await supabase.from("company_users")
      .select("company_id, role").eq("user_id", user.id)
      .eq("status", "active").limit(1).maybeSingle();
    setCompanyId(cu?.company_id ?? "");
    setUserRole(cu?.role ?? "");

    const isAdminRole = ["admin", "director", "clinical_director", "supervisor", "bcba"].includes(cu?.role ?? "");

    const [{ data: entryData }, { data: clientData }, { data: profileData }] = await Promise.all([
      isAdminRole
        ? supabase.from("schedule_entries").select("*").eq("company_id", cu?.company_id).order("date").order("start_time")
        : supabase.from("schedule_entries").select("*").eq("assigned_to", user.id).order("date").order("start_time"),
      supabase.from("clients").select("id, full_name").eq("company_id", cu?.company_id),
      supabase.from("company_users").select("user_id, role, profiles(full_name)")
        .eq("company_id", cu?.company_id).eq("status", "active"),
    ]);

    setEntries(entryData ?? []);
    setClients(clientData ?? []);
    setProfiles((profileData ?? []).map((p: any) => ({
      id: p.user_id, full_name: p.profiles?.full_name ?? null, role: p.role,
    })));
    setLoading(false);
  }

  function getInitials(fullName: string) {
    return fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 3);
  }

  async function handleSave() {
    if (!form.date || !form.session_type) { setError("Date and session type are required."); return; }
    setSaving(true); setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const client = clients.find(c => c.id === form.client_id);
    const initials = client ? getInitials(client.full_name) : form.client_initials;

    const payload = {
      company_id: companyId,
      client_id: form.client_id || null,
      client_initials: initials,
      date: form.date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      session_type: form.session_type,
      is_telehealth: form.is_telehealth || form.session_type === "Telehealth",
      address: form.address || null,
      telehealth_link: form.telehealth_link || null,
      bcba_name: form.bcba_name || null,
      status: form.status,
      assigned_to: form.assigned_to || null,
      created_by: user.id,
    };

    if (editingId) {
      const { data: prevEntry } = await supabase
        .from("schedule_entries")
        .select("status, client_id")
        .eq("id", editingId)
        .maybeSingle();

      await supabase.from("schedule_entries").update(payload).eq("id", editingId);
      setEntries(prev => prev.map(e => e.id === editingId ? { ...e, ...payload, id: editingId } : e));

      // Fire cancellation SMS if status changed to cancelled and client is set
      if (payload.status === "cancelled" && prevEntry?.status !== "cancelled" && payload.client_id) {
        try {
          await fetch("/api/sms/queue-cancellation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scheduleEntryId: editingId,
              companyId,
              clientId: payload.client_id,
              date: payload.date,
              startTime: payload.start_time,
              sessionType: payload.session_type,
            }),
          });
        } catch {
          // Non-blocking — SMS failure should not prevent save
        }
      }

      setEditingId(null);
    } else {
      const { data } = await supabase.from("schedule_entries").insert([payload]).select().single();
      if (data) setEntries(prev => [...prev, data]);
    }

    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("schedule_entries").delete().eq("id", id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  function openEdit(entry: ScheduleEntry) {
    setForm({
      client_id: entry.client_id ?? "",
      client_initials: entry.client_initials,
      date: entry.date,
      start_time: entry.start_time ?? "",
      end_time: entry.end_time ?? "",
      session_type: entry.session_type,
      is_telehealth: entry.is_telehealth,
      address: entry.address ?? "",
      telehealth_link: entry.telehealth_link ?? "",
      bcba_name: entry.bcba_name ?? "",
      status: entry.status,
      assigned_to: entry.assigned_to ?? "",
    });
    setEditingId(entry.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateDate(dir: number) {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    if (view === "week") d.setDate(d.getDate() + dir * 7);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  }

  function getDateRange() {
    const d = new Date(currentDate);
    if (view === "day") return { start: d, end: d };
    if (view === "week") {
      const start = new Date(d); start.setDate(d.getDate() - d.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return { start, end };
    }
    return {
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0),
    };
  }

  function formatRange() {
    const { start, end } = getDateRange();
    if (view === "day") return start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (view === "week") return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  const { start, end } = getDateRange();
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const filtered = view === "list" ? entries : entries.filter(e => e.date >= startStr && e.date <= endStr);
  const grouped = filtered.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {} as Record<string, ScheduleEntry[]>);

  const todayEntries = entries.filter(e => e.date === today);
  const canManage = ["admin", "director", "clinical_director", "supervisor", "bcba"].includes(userRole);

  function getWeekDays() {
    const { start } = getDateRange();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }

  function getMonthDays() {
    const { start, end } = getDateRange();
    const days: string[] = [];
    const d = new Date(start);
    while (d <= end) { days.push(d.toISOString().split("T")[0]); d.setDate(d.getDate() + 1); }
    return days;
  }

  function entryColor(entry: ScheduleEntry) {
    return SESSION_COLORS[entry.session_type] ?? "#6b7280";
  }

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule / Calendar">
        {canManage && (
          <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(!showForm); }}>
            {showForm ? "Cancel" : "+ Add Session"}
          </Button>
        )}
      </PageHeader>

      {/* TODAY SUMMARY */}
      {todayEntries.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-700 mb-2">📅 Today — {todayEntries.length} session{todayEntries.length !== 1 ? "s" : ""}</p>
          <div className="flex flex-wrap gap-2">
            {todayEntries.map(e => (
              <div key={e.id} onClick={() => canManage && openEdit(e)}
                className="bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs cursor-pointer hover:shadow-sm"
                style={{ borderLeftColor: entryColor(e), borderLeftWidth: 3 }}>
                <p className="font-bold text-gray-800">{e.client_initials}</p>
                <p className="text-gray-500">{e.start_time?.slice(0, 5)} · {e.session_type}</p>
                {e.bcba_name && <p className="text-blue-600 text-xs">{e.bcba_name}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FORM */}
      {showForm && canManage && (
        <Section title={editingId ? "Edit Session" : "Schedule New Session"}>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
              <select value={form.client_id} onChange={e => {
                const client = clients.find(c => c.id === e.target.value);
                setForm({ ...form, client_id: e.target.value, client_initials: client ? getInitials(client.full_name) : "" });
              }} className={inputClass}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              {form.client_initials && <p className="text-xs text-gray-400 mt-1">Displays as: <strong>{form.client_initials}</strong></p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Type *</label>
              <select value={form.session_type} onChange={e => setForm({ ...form, session_type: e.target.value })} className={inputClass}>
                {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Start Time</label>
              <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">End Time</label>
              <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">BCBA / Supervisor</label>
              <select value={form.bcba_name} onChange={e => setForm({ ...form, bcba_name: e.target.value })} className={inputClass}>
                <option value="">Select...</option>
                {profiles.filter(p => ["bcba", "supervisor", "clinical_director"].includes(p.role ?? "")).map(p => (
                  <option key={p.id} value={p.full_name ?? ""}>{p.full_name} ({p.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Assigned To</label>
              <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className={inputClass}>
                <option value="">All assigned staff</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass}>
                {["scheduled", "completed", "cancelled", "no_show", "rescheduled"].map(s => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Location / Address</label>
              <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Address or location name" className={inputClass} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" checked={form.is_telehealth}
                onChange={e => setForm({ ...form, is_telehealth: e.target.checked })} className="w-4 h-4" />
              <label className="text-sm text-gray-700">Telehealth session</label>
            </div>
            {(form.is_telehealth || form.session_type === "Telehealth") && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Telehealth Link</label>
                <input type="url" value={form.telehealth_link} onChange={e => setForm({ ...form, telehealth_link: e.target.value })}
                  placeholder="https://zoom.us/..." className={inputClass} />
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>{editingId ? "Update" : "Save Session"}</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>Cancel</Button>
            {editingId && <Button variant="outline" onClick={() => { handleDelete(editingId); setShowForm(false); setEditingId(null); }}>🗑 Delete</Button>}
          </div>
        </Section>
      )}

      {/* VIEW CONTROLS */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
          {(["day", "week", "month", "list"] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${view === v ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
              {v}
            </button>
          ))}
        </div>
        {view !== "list" && (
          <>
            <button onClick={() => navigateDate(-1)} className="p-2 border rounded-lg hover:bg-gray-50 text-sm">←</button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 border rounded-lg text-xs hover:bg-gray-50">Today</button>
            <button onClick={() => navigateDate(1)} className="p-2 border rounded-lg hover:bg-gray-50 text-sm">→</button>
          </>
        )}
        <p className="text-sm font-medium text-gray-700">{formatRange()}</p>
        <p className="text-sm text-gray-400 ml-auto">{filtered.length} sessions</p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading schedule...</p>}

      {/* WEEK VIEW */}
      {view === "week" && (
        <div className="grid grid-cols-7 gap-1">
          {getWeekDays().map(date => {
            const dayItems = grouped[date] ?? [];
            const isToday = date === today;
            const dayName = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
            const dayNum = new Date(date + "T00:00:00").getDate();
            return (
              <div key={date} className={`min-h-24 border rounded-lg p-1 ${isToday ? "border-blue-300 bg-blue-50" : "border-gray-100 bg-white"}`}>
                <div className="text-center mb-1">
                  <p className="text-xs text-gray-400">{dayName}</p>
                  <p className={`text-sm font-semibold ${isToday ? "text-blue-600" : "text-gray-700"}`}>{dayNum}</p>
                </div>
                {dayItems.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")).map(item => (
                  <div key={item.id} onClick={() => canManage && openEdit(item)}
                    className="text-xs p-1 rounded mb-1 cursor-pointer text-white truncate"
                    style={{ backgroundColor: entryColor(item) }}>
                    <p className="font-bold truncate">{item.client_initials || item.session_type.slice(0, 3)}</p>
                    <p className="opacity-80">{item.start_time?.slice(0, 5)}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* MONTH VIEW */}
      {view === "month" && (
        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <p key={d} className="text-xs text-center text-gray-400 py-1">{d}</p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: new Date(start.getFullYear(), start.getMonth(), 1).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-16 border border-gray-50 rounded-lg bg-gray-50" />
            ))}
            {getMonthDays().map(date => {
              const dayItems = grouped[date] ?? [];
              const isToday = date === today;
              return (
                <div key={date} className={`min-h-16 border rounded-lg p-1 ${isToday ? "border-blue-300 bg-blue-50" : "border-gray-100 bg-white"}`}>
                  <p className={`text-xs font-medium mb-1 ${isToday ? "text-blue-600" : "text-gray-500"}`}>
                    {new Date(date + "T00:00:00").getDate()}
                  </p>
                  {dayItems.slice(0, 2).map(item => (
                    <div key={item.id} onClick={() => canManage && openEdit(item)}
                      className="text-xs px-1 py-0.5 rounded mb-0.5 cursor-pointer text-white truncate"
                      style={{ backgroundColor: entryColor(item) }}>
                      {item.client_initials || item.session_type.slice(0, 6)}
                    </div>
                  ))}
                  {dayItems.length > 2 && <p className="text-xs text-gray-400">+{dayItems.length - 2}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAY VIEW */}
      {view === "day" && (
        Object.keys(grouped).length === 0 ? (
          <Section title="No Sessions">
            <p className="text-gray-400 text-sm">No sessions scheduled for this day.</p>
          </Section>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <Section key={date} title={new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}>
              <div className="space-y-2">
                {items.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")).map(item => (
                  <div key={item.id} onClick={() => canManage && openEdit(item)}
                    className="border rounded-xl p-4 bg-white flex justify-between items-start cursor-pointer hover:shadow-sm"
                    style={{ borderLeftColor: entryColor(item), borderLeftWidth: 4 }}>
                    <div className="flex gap-4 items-start">
                      <div className="text-center min-w-[48px]">
                        <p className="text-lg font-bold" style={{ color: entryColor(item) }}>{item.start_time?.slice(0, 5)}</p>
                        {item.end_time && <p className="text-xs text-gray-400">{item.end_time.slice(0, 5)}</p>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-2xl text-gray-800">{item.client_initials}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{item.session_type}</span>
                          {item.is_telehealth && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">📱 Telehealth</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {item.status.replace("_", " ")}
                          </span>
                        </div>
                        {item.bcba_name && <p className="text-sm text-purple-600 font-medium">BCBA: {item.bcba_name}</p>}
                        {item.address && <p className="text-xs text-gray-400">📍 {item.address}</p>}
                        {item.telehealth_link && (
                          <a href={item.telehealth_link} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>
                            🔗 Join Telehealth
                          </a>
                        )}
                      </div>
                    </div>
                    {canManage && <span className="text-xs text-blue-500 hover:underline shrink-0">Edit</span>}
                  </div>
                ))}
              </div>
            </Section>
          ))
        )
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <Section title={`All Sessions (${filtered.length})`}>
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-sm">No sessions scheduled.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(item => (
                <div key={item.id} onClick={() => canManage && openEdit(item)}
                  className="border border-gray-100 rounded-lg p-3 bg-white flex justify-between items-center cursor-pointer hover:shadow-sm"
                  style={{ borderLeftColor: entryColor(item), borderLeftWidth: 3 }}>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-gray-800">{item.client_initials || "—"}</p>
                      <span className="text-xs text-gray-500">{item.session_type}</span>
                      {item.is_telehealth && <span className="text-xs text-blue-500">📱</span>}
                    </div>
                    <p className="text-xs text-gray-400">
                      {item.date} · {item.start_time?.slice(0, 5)}{item.end_time ? ` – ${item.end_time.slice(0, 5)}` : ""}
                      {item.bcba_name && ` · BCBA: ${item.bcba_name}`}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {item.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
