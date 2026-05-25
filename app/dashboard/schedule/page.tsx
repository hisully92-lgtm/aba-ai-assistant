"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Location = { id: string; name: string; address: string | null };

type ScheduleItem = {
  id: string;
  client_name: string;
  staff_member: string;
  session_date: string;
  session_time: string;
  location: string;
  duration: string;
  notes: string;
  color: string | null;
  is_recurring: boolean | null;
  recurrence_rule: string | null;
  created_at: string;
};

const DURATIONS = ["30 min", "45 min", "1 hour", "1.5 hours", "2 hours", "2.5 hours", "3 hours"];
const STAFF_ROLES = ["BCBA", "Clinical Director", "Student Analyst", "RBT", "BT", "Caregiver"];
const RECURRENCE_RULES = ["weekly", "biweekly", "monthly"];
const SESSION_COLORS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#22c55e" },
  { label: "Purple", value: "#a855f7" },
  { label: "Orange", value: "#f97316" },
  { label: "Red", value: "#ef4444" },
  { label: "Pink", value: "#ec4899" },
  { label: "Teal", value: "#14b8a6" },
];

const emptyForm = {
  client_id: "",
  client_name: "",
  staff_member: "",
  staff_role: "",
  session_date: "",
  session_time: "",
  location: "",
  duration: "",
  notes: "",
  color: "#3b82f6",
  is_recurring: false,
  recurrence_rule: "",
};

type ViewMode = "day" | "week" | "month" | "list";

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: scheduleData }, { data: clientData }, { data: locationData }] = await Promise.all([
      supabase.from("schedule").select("*").eq("created_by", user.id).order("session_date", { ascending: true }),
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("locations").select("id, name, address"),
    ]);

    setSchedule(scheduleData ?? []);
    setClients(clientData ?? []);
    setLocations(locationData ?? []);
    setLoading(false);
  }

  function openEdit(item: ScheduleItem) {
    const client = clients.find((c) => c.full_name === item.client_name);
    setForm({
      client_id: client?.id ?? "",
      client_name: item.client_name,
      staff_member: item.staff_member.split(" (")[0],
      staff_role: item.staff_member.match(/\((.+)\)/)?.[1] ?? "",
      session_date: item.session_date,
      session_time: item.session_time,
      location: item.location,
      duration: item.duration,
      notes: item.notes,
      color: item.color ?? "#3b82f6",
      is_recurring: item.is_recurring ?? false,
      recurrence_rule: item.recurrence_rule ?? "",
    });
    setEditingItem(item);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (!form.client_name || !form.session_date || !form.session_time) {
      setError("Client, date and time are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const payload = {
      client_name: form.client_name,
      staff_member: `${form.staff_member}${form.staff_role ? ` (${form.staff_role})` : ""}`,
      session_date: form.session_date,
      session_time: form.session_time,
      location: form.location,
      duration: form.duration,
      notes: form.notes,
      color: form.color,
      is_recurring: form.is_recurring,
      recurrence_rule: form.is_recurring ? form.recurrence_rule : null,
    };

    if (editingItem) {
      const { data, error: updateError } = await supabase
        .from("schedule")
        .update(payload)
        .eq("id", editingItem.id)
        .select()
        .single();

      if (updateError) { setError(updateError.message); setSaving(false); return; }

      setSchedule((prev) => prev.map((s) => s.id === editingItem.id ? data : s));
      setEditingItem(null);
    } else {
      const { data, error: saveError } = await supabase
        .from("schedule")
        .insert([{ ...payload, created_by: user.id }])
        .select()
        .single();

      if (saveError) { setError(saveError.message); setSaving(false); return; }

      // If recurring, create next occurrences
      if (form.is_recurring && form.recurrence_rule && data) {
        const extraDates: string[] = [];
        const baseDate = new Date(form.session_date);
        const weeks = form.recurrence_rule === "weekly" ? 1 : form.recurrence_rule === "biweekly" ? 2 : 4;

        for (let i = 1; i <= 8; i++) {
          const next = new Date(baseDate);
          next.setDate(next.getDate() + weeks * 7 * i);
          extraDates.push(next.toISOString().split("T")[0]);
        }

        await supabase.from("schedule").insert(
          extraDates.map((d) => ({ ...payload, session_date: d, created_by: user.id }))
        );
      }

      await init();
    }

    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("schedule").delete().eq("id", id);
    setSchedule((prev) => prev.filter((s) => s.id !== id));
  }

  // DATE NAVIGATION
  function getDateRange(): { start: Date; end: Date } {
    const d = new Date(currentDate);
    if (view === "day") {
      return { start: d, end: d };
    }
    if (view === "week") {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start, end };
    }
    if (view === "month") {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { start, end };
    }
    return { start: new Date(0), end: new Date(9999, 11, 31) };
  }

  function navigateDate(direction: number) {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + direction);
    if (view === "week") d.setDate(d.getDate() + direction * 7);
    if (view === "month") d.setMonth(d.getMonth() + direction);
    setCurrentDate(d);
  }

  function formatDateRange(): string {
    const { start, end } = getDateRange();
    if (view === "day") return start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (view === "week") return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    if (view === "month") return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return "All Sessions";
  }

  const { start, end } = getDateRange();
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  const filtered = view === "list"
    ? schedule
    : schedule.filter((s) => s.session_date >= startStr && s.session_date <= endStr);

  const grouped = filtered.reduce((acc, item) => {
    const date = item.session_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, ScheduleItem[]>);

  const today = new Date().toISOString().split("T")[0];
  const todaySessions = schedule.filter((s) => s.session_date === today);

  // WEEK VIEW GRID
  function getWeekDays(): string[] {
    const { start } = getDateRange();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }

  // MONTH VIEW GRID
  function getMonthDays(): string[] {
    const { start, end } = getDateRange();
    const days: string[] = [];
    const d = new Date(start);
    while (d <= end) {
      days.push(d.toISOString().split("T")[0]);
      d.setDate(d.getDate() + 1);
    }
    return days;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule / Calendar">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => { setEditingItem(null); setForm(emptyForm); setShowForm(!showForm); }}>
            {showForm ? "Cancel" : "+ Add Session"}
          </Button>
        </div>
      </PageHeader>

      {/* TODAY SUMMARY */}
      {todaySessions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-700 mb-2">
            📅 Today — {todaySessions.length} session{todaySessions.length !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {todaySessions.map((s) => (
              <div
                key={s.id}
                onClick={() => openEdit(s)}
                className="bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs cursor-pointer hover:shadow-sm"
                style={{ borderLeftColor: s.color ?? "#3b82f6", borderLeftWidth: 3 }}
              >
                <p className="font-semibold text-gray-800">{s.client_name}</p>
                <p className="text-gray-500">{s.session_time.slice(0, 5)} · {s.duration}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <Section title={editingItem ? "Edit Session" : "Schedule New Session"}>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select
                value={form.client_id}
                onChange={(e) => {
                  const client = clients.find((c) => c.id === e.target.value);
                  setForm({ ...form, client_id: e.target.value, client_name: client?.full_name ?? "" });
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date *</label>
              <input type="date" value={form.session_date}
                onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Time *</label>
              <input type="time" value={form.session_time}
                onChange={(e) => setForm({ ...form, session_time: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Duration</label>
              <select value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select duration...</option>
                {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Staff Member</label>
              <input type="text" value={form.staff_member}
                onChange={(e) => setForm({ ...form, staff_member: e.target.value })}
                placeholder="Staff name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Staff Role</label>
              <select value={form.staff_role}
                onChange={(e) => setForm({ ...form, staff_role: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select role...</option>
                {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Location</label>
              <select value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select location...</option>
                {locations.map((l) => <option key={l.id} value={l.name}>{l.name}{l.address ? ` — ${l.address}` : ""}</option>)}
                <option value="Home">Home</option>
                <option value="School">School</option>
                <option value="Clinic">Clinic</option>
                <option value="Telehealth">Telehealth</option>
                <option value="Community">Community</option>
              </select>
            </div>

            {/* COLOR */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {SESSION_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setForm({ ...form, color: c.value })}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c.value ? "border-gray-800 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* RECURRING */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Recurring</label>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">Repeat this session</span>
              </div>
              {form.is_recurring && (
                <select
                  value={form.recurrence_rule}
                  onChange={(e) => setForm({ ...form, recurrence_rule: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">Select frequency...</option>
                  {RECURRENCE_RULES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Session notes..."
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>
              {editingItem ? "Update Session" : "Save Session"}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingItem(null); setForm(emptyForm); }}>Cancel</Button>
            {editingItem && (
              <Button variant="danger" onClick={() => { handleDelete(editingItem.id); setShowForm(false); setEditingItem(null); }}>
                Delete
              </Button>
            )}
          </div>
        </Section>
      )}

      {/* VIEW CONTROLS */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
          {(["day", "week", "month", "list"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                view === v ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {view !== "list" && (
          <>
            <button onClick={() => navigateDate(-1)} className="p-2 border rounded-lg hover:bg-gray-50">←</button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 border rounded-lg text-xs hover:bg-gray-50">Today</button>
            <button onClick={() => navigateDate(1)} className="p-2 border rounded-lg hover:bg-gray-50">→</button>
          </>
        )}

        <p className="text-sm font-medium text-gray-700">{formatDateRange()}</p>
        <p className="text-sm text-gray-400 ml-auto">{filtered.length} sessions</p>
      </div>

      {loading && <p className="text-gray-400">Loading schedule...</p>}

      {/* WEEK VIEW */}
      {view === "week" && (
        <div className="grid grid-cols-7 gap-1">
          {getWeekDays().map((date) => {
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
                {dayItems.sort((a, b) => a.session_time.localeCompare(b.session_time)).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => openEdit(item)}
                    className="text-xs p-1 rounded mb-1 cursor-pointer text-white truncate"
                    style={{ backgroundColor: item.color ?? "#3b82f6" }}
                  >
                    <p className="font-medium truncate">{item.client_name}</p>
                    <p className="opacity-80">{item.session_time.slice(0, 5)}</p>
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
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <p key={d} className="text-xs text-center text-gray-400 py-1">{d}</p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for first week offset */}
            {Array.from({ length: new Date(start.getFullYear(), start.getMonth(), 1).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-16 border border-gray-50 rounded-lg bg-gray-50" />
            ))}
            {getMonthDays().map((date) => {
              const dayItems = grouped[date] ?? [];
              const isToday = date === today;
              const dayNum = new Date(date + "T00:00:00").getDate();
              return (
                <div key={date} className={`min-h-16 border rounded-lg p-1 ${isToday ? "border-blue-300 bg-blue-50" : "border-gray-100 bg-white"}`}>
                  <p className={`text-xs font-medium mb-1 ${isToday ? "text-blue-600" : "text-gray-500"}`}>{dayNum}</p>
                  {dayItems.slice(0, 2).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => openEdit(item)}
                      className="text-xs px-1 py-0.5 rounded mb-0.5 cursor-pointer text-white truncate"
                      style={{ backgroundColor: item.color ?? "#3b82f6" }}
                    >
                      {item.client_name}
                    </div>
                  ))}
                  {dayItems.length > 2 && (
                    <p className="text-xs text-gray-400">+{dayItems.length - 2} more</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAY VIEW */}
      {view === "day" && (
        <>
          {Object.keys(grouped).length === 0 ? (
            <Section title="No Sessions">
              <p className="text-gray-400 text-sm">No sessions scheduled for this day.</p>
            </Section>
          ) : (
            Object.entries(grouped).map(([date, items]) => (
              <Section key={date} title={new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}>
                <div className="space-y-2">
                  {items.sort((a, b) => a.session_time.localeCompare(b.session_time)).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => openEdit(item)}
                      className="border rounded-xl p-4 bg-white flex justify-between items-start cursor-pointer hover:shadow-sm transition-shadow"
                      style={{ borderLeftColor: item.color ?? "#3b82f6", borderLeftWidth: 4 }}
                    >
                      <div className="flex gap-4 items-start">
                        <div className="text-center min-w-[48px]">
                          <p className="text-lg font-bold" style={{ color: item.color ?? "#3b82f6" }}>
                            {item.session_time.slice(0, 5)}
                          </p>
                          <p className="text-xs text-gray-400">{item.duration}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-800">{item.client_name}</p>
                            {item.is_recurring && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">🔁 {item.recurrence_rule}</span>}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">{item.staff_member} · {item.location}</p>
                          {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
                        </div>
                      </div>
                      <span className="text-xs text-blue-500 hover:underline">Edit</span>
                    </div>
                  ))}
                </div>
              </Section>
            ))
          )}
        </>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <Section title={`All Sessions (${filtered.length})`}>
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-sm">No sessions scheduled.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openEdit(item)}
                  className="border border-gray-100 rounded-lg p-3 bg-white flex justify-between items-center cursor-pointer hover:shadow-sm"
                  style={{ borderLeftColor: item.color ?? "#3b82f6", borderLeftWidth: 3 }}
                >
                  <div>
                    <p className="font-medium text-gray-800">{item.client_name}</p>
                    <p className="text-xs text-gray-400">
                      {item.session_date} · {item.session_time.slice(0, 5)} · {item.duration} · {item.location}
                    </p>
                    <p className="text-xs text-gray-400">Staff: {item.staff_member}</p>
                    {item.is_recurring && <span className="text-xs text-purple-600">🔁 {item.recurrence_rule}</span>}
                  </div>
                  <span className="text-xs text-blue-500">Edit</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}