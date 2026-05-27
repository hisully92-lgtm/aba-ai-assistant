"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type AvailabilityEntry = {
  id: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  availability_type: string;
  recurring: boolean;
  notes: string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6am - 8pm

const AVAILABILITY_TYPES = [
  { value: "available", label: "Available", color: "bg-green-500", light: "bg-green-100 border-green-300 text-green-700" },
  { value: "unavailable", label: "Blocked / Unavailable", color: "bg-red-400", light: "bg-red-100 border-red-300 text-red-700" },
  { value: "tentative", label: "Tentative", color: "bg-yellow-400", light: "bg-yellow-100 border-yellow-300 text-yellow-700" },
  { value: "vacation", label: "Vacation / Time Off", color: "bg-purple-400", light: "bg-purple-100 border-purple-300 text-purple-700" },
  { value: "preferred", label: "Preferred Hours", color: "bg-blue-400", light: "bg-blue-100 border-blue-300 text-blue-700" },
];

const emptyForm = {
  day_of_week: null as number | null,
  specific_date: "",
  start_time: "09:00",
  end_time: "17:00",
  availability_type: "available",
  recurring: true,
  notes: "",
};

export default function StaffAvailabilityPage() {
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [viewMode, setViewMode] = useState<"week" | "list">("week");
  const [inputMode, setInputMode] = useState<"recurring" | "specific">("recurring");
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    return new Date(now.setDate(diff)).toISOString().split("T")[0];
  });

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("staff_availability")
      .select("*")
      .eq("user_id", user.id)
      .order("day_of_week", { ascending: true });

    setEntries(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if ((!form.day_of_week && form.day_of_week !== 0 && !form.specific_date) || !form.start_time || !form.end_time) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("staff_availability").insert([{
      user_id: user.id,
      day_of_week: inputMode === "recurring" ? form.day_of_week : null,
      specific_date: inputMode === "specific" ? form.specific_date : null,
      start_time: form.start_time,
      end_time: form.end_time,
      availability_type: form.availability_type,
      recurring: inputMode === "recurring",
      notes: form.notes || null,
      created_by: user.id,
    }]).select().single();

    if (data) setEntries((prev) => [...prev, data].sort((a, b) => (a.day_of_week ?? 7) - (b.day_of_week ?? 7)));
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function deleteEntry(id: string) {
    await supabase.from("staff_availability").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function formatTime(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "pm" : "am";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${m.toString().padStart(2, "0")}${ampm}`;
  }

  function timeToDecimal(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h + m / 60;
  }

  function getEntriesForSlot(dayIndex: number, hour: number): AvailabilityEntry[] {
    return entries.filter((e) => {
      if (!e.recurring || e.day_of_week !== dayIndex) return false;
      const start = timeToDecimal(e.start_time);
      const end = timeToDecimal(e.end_time);
      return hour >= start && hour < end;
    });
  }

  function getSpecificDateEntries(): AvailabilityEntry[] {
    return entries.filter((e) => !e.recurring && e.specific_date);
  }

  function getTypeStyle(type: string) {
    return AVAILABILITY_TYPES.find((t) => t.value === type) ?? AVAILABILITY_TYPES[0];
  }

  // Week dates
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const recurringEntries = entries.filter((e) => e.recurring);
  const specificEntries = getSpecificDateEntries();

  return (
    <div className="space-y-6">
      <PageHeader title="My Availability">
        <div className="flex gap-2">
          <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
            {[{ key: "week", label: "Week View" }, { key: "list", label: "List View" }].map((m) => (
              <button key={m.key} onClick={() => setViewMode(m.key as any)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === m.key ? "bg-blue-600 text-white" : "text-gray-500"}`}>
                {m.label}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Availability"}
          </Button>
        </div>
      </PageHeader>

      {/* LEGEND */}
      <div className="flex flex-wrap gap-2">
        {AVAILABILITY_TYPES.map((type) => (
          <div key={type.value} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${type.light}`}>
            <div className={`w-2 h-2 rounded-full ${type.color}`} />
            {type.label}
          </div>
        ))}
      </div>

      {/* ADD FORM */}
      {showForm && (
        <Section title="Add Availability Block">
          <div className="flex gap-2 mb-4">
            {[
              { key: "recurring", label: "🔄 Recurring (weekly)" },
              { key: "specific", label: "📅 Specific Date" },
            ].map((m) => (
              <button key={m.key} onClick={() => setInputMode(m.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${inputMode === m.key ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputMode === "recurring" ? (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Day of Week *</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day, i) => (
                    <button key={i} onClick={() => setForm({ ...form, day_of_week: i })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.day_of_week === i ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-400"}`}>
                      {DAYS_SHORT[i]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Specific Date *</label>
                <input type="date" value={form.specific_date}
                  onChange={(e) => setForm({ ...form, specific_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
              <select value={form.availability_type}
                onChange={(e) => setForm({ ...form, availability_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {AVAILABILITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Start Time *</label>
              <input type="time" value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">End Time *</label>
              <input type="time" value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <input type="text" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Block</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* WEEK VIEW */}
      {viewMode === "week" && (
        <Section title="Weekly Availability Calendar">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => {
              const d = new Date(currentWeek);
              d.setDate(d.getDate() - 7);
              setCurrentWeek(d.toISOString().split("T")[0]);
            }} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">← Prev</button>
            <p className="text-sm font-medium text-gray-700 flex-1 text-center">
              Week of {new Date(currentWeek).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
            <button onClick={() => {
              const d = new Date(currentWeek);
              d.setDate(d.getDate() + 7);
              setCurrentWeek(d.toISOString().split("T")[0]);
            }} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">Next →</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: "600px" }}>
              <thead>
                <tr>
                  <th className="w-14 p-2 text-gray-400 font-medium border border-gray-100">Time</th>
                  {weekDates.map((date, i) => (
                    <th key={i} className={`p-2 font-medium border border-gray-100 text-center ${date.toDateString() === new Date().toDateString() ? "bg-blue-50 text-blue-700" : "text-gray-600"}`}>
                      <div>{DAYS_SHORT[date.getDay()]}</div>
                      <div className="text-base font-bold">{date.getDate()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="p-1.5 text-gray-400 border border-gray-100 text-center text-xs">
                      {hour > 12 ? `${hour - 12}p` : hour === 12 ? "12p" : `${hour}a`}
                    </td>
                    {weekDates.map((date, dayIdx) => {
                      const slotEntries = getEntriesForSlot(date.getDay(), hour);
                      return (
                        <td key={dayIdx} className="p-0.5 border border-gray-100 align-top" style={{ minWidth: "70px", height: "32px" }}>
                          {slotEntries.map((e) => {
                            const style = getTypeStyle(e.availability_type);
                            return (
                              <div key={e.id} className={`${style.color} opacity-80 rounded text-white text-xs px-1 py-0.5 truncate`}
                                title={`${style.label}: ${formatTime(e.start_time)} - ${formatTime(e.end_time)}`}>
                                {style.label.split(" ")[0]}
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {recurringEntries.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-4">No recurring availability set. Click "+ Add Availability" to get started.</p>
          )}
        </Section>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="space-y-4">
          {/* RECURRING */}
          <Section title="Recurring Weekly Schedule">
            {loading && <p className="text-gray-400 text-sm">Loading...</p>}
            {!loading && recurringEntries.length === 0 && (
              <p className="text-gray-400 text-sm">No recurring availability set.</p>
            )}
            {DAYS.map((day, dayIdx) => {
              const dayEntries = recurringEntries.filter((e) => e.day_of_week === dayIdx);
              if (dayEntries.length === 0) return null;
              return (
                <div key={dayIdx} className="mb-3">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">{day}</p>
                  <div className="space-y-1">
                    {dayEntries.map((entry) => {
                      const style = getTypeStyle(entry.availability_type);
                      return (
                        <div key={entry.id} className={`flex items-center justify-between border rounded-lg p-2.5 ${style.light}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${style.color}`} />
                            <span className="text-sm font-medium">{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</span>
                            <span className="text-xs opacity-70">{style.label}</span>
                            {entry.notes && <span className="text-xs opacity-60">· {entry.notes}</span>}
                          </div>
                          <button onClick={() => deleteEntry(entry.id)} className="text-gray-400 hover:text-red-400 text-xs">✕</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Section>

          {/* SPECIFIC DATES */}
          {specificEntries.length > 0 && (
            <Section title="Specific Date Blocks">
              <div className="space-y-2">
                {specificEntries.sort((a, b) => (a.specific_date ?? "").localeCompare(b.specific_date ?? "")).map((entry) => {
                  const style = getTypeStyle(entry.availability_type);
                  return (
                    <div key={entry.id} className={`flex items-center justify-between border rounded-lg p-3 ${style.light}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${style.color}`} />
                        <span className="text-sm font-medium">{entry.specific_date}</span>
                        <span className="text-xs">{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</span>
                        <span className="text-xs opacity-70">{style.label}</span>
                        {entry.notes && <span className="text-xs opacity-60">· {entry.notes}</span>}
                      </div>
                      <button onClick={() => deleteEntry(entry.id)} className="text-gray-400 hover:text-red-400 text-xs">✕</button>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}