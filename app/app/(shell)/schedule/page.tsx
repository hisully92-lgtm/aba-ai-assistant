"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/app/AppShell";

type ScheduleEntry = {
  id: string;
  client_id: string;
  client_initials: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  session_type: string;
  is_telehealth: boolean;
  address: string | null;
  telehealth_link: string | null;
  bcba_name: string | null;
  status: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function SchedulePage() {
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, [selectedDate.getMonth(), selectedDate.getFullYear()]); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).toISOString().split("T")[0];

    const { data } = await supabase
      .from("schedule_entries")
      .select("*")
      .eq("assigned_to", user.id)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .order("date")
      .order("start_time");

    setEntries(data ?? []);
    setLoading(false);
  }

  function getWeekDates(date: Date) {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }

  function getDaysInMonth(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }

  function formatDate(date: Date) { return date.toISOString().split("T")[0]; }
  function getEntriesForDate(date: Date) { return entries.filter(e => e.date === formatDate(date)); }

  function sessionColor(entry: ScheduleEntry) {
    if (entry.status === "completed") return "#16a34a";
    if (entry.is_telehealth) return "#7c3aed";
    if (entry.session_type === "Supervision") return "#d97706";
    return "#2563eb";
  }

  function navigate(direction: number) {
    const newDate = new Date(selectedDate);
    if (view === "day") newDate.setDate(newDate.getDate() + direction);
    else if (view === "week") newDate.setDate(newDate.getDate() + direction * 7);
    else newDate.setMonth(newDate.getMonth() + direction);
    setSelectedDate(newDate);
  }

  const todayEntries = getEntriesForDate(selectedDate);
  const weekDates = getWeekDates(selectedDate);
  const monthDays = getDaysInMonth(selectedDate);
  const isToday = formatDate(selectedDate) === formatDate(new Date());

  if (loading) {
    return <AppShell title="Schedule"><div className="flex justify-center py-20"><p className="text-gray-400 text-sm">Loading...</p></div></AppShell>;
  }

  return (
    <AppShell title="Schedule">
      {/* VIEW TOGGLE */}
      <div className="flex justify-center gap-1 px-4 py-2 bg-white border-b border-gray-100">
        {(["day", "week", "month"] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize"
            style={view === v ? { backgroundColor: "#2563eb", color: "#fff" } : { color: "#6b7280" }}>
            {v}
          </button>
        ))}
      </div>

      {/* NAV */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-full text-xl text-gray-600">‹</button>
        <p className="text-[15px] font-bold text-gray-900">
          {view === "day"
            ? `${DAYS[selectedDate.getDay()]}, ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}`
            : view === "week"
            ? `Week of ${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()}`
            : `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`}
        </p>
        <button onClick={() => navigate(1)} className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-full text-xl text-gray-600">›</button>
      </div>

      <div className="pb-10">
        {/* DAY VIEW */}
        {view === "day" && (
          <div className="p-4">
            {isToday && <span className="inline-block mb-3 text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>Today</span>}
            {todayEntries.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <p className="text-5xl mb-3">📅</p>
                <p className="text-sm text-gray-400">No sessions scheduled</p>
              </div>
            ) : (
              todayEntries.map(entry => (
                <div key={entry.id} className="bg-white rounded-xl p-3.5 mb-2.5 shadow-sm" style={{ borderLeft: `4px solid ${sessionColor(entry)}` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sessionColor(entry) }} />
                    <span className="text-[15px] font-bold text-gray-900 flex-1">{entry.client_initials}</span>
                    <span className="text-xs text-gray-500">{entry.is_telehealth ? "📹 Telehealth" : "📍 In Person"}</span>
                    {entry.session_type === "Supervision" && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>Supervision</span>
                    )}
                  </div>
                  {entry.start_time && <p className="text-[13px] text-gray-500 mb-1">{entry.start_time}{entry.end_time ? ` → ${entry.end_time}` : ""}</p>}
                  {entry.bcba_name && <p className="text-xs text-gray-400 mt-0.5">👩‍⚕️ {entry.bcba_name}</p>}
                  {entry.is_telehealth && entry.telehealth_link ? (
                    <p className="text-xs mt-0.5" style={{ color: "#2563eb" }}>🔗 {entry.telehealth_link}</p>
                  ) : entry.address ? (
                    <p className="text-xs text-gray-400 mt-0.5">📍 {entry.address}</p>
                  ) : null}
                  <span className="inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: entry.status === "completed" ? "#dcfce7" : "#fef9c3", color: "#374151" }}>
                    {entry.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* WEEK VIEW */}
        {view === "week" && (
          <div className="p-4">
            <div className="flex bg-white rounded-xl p-2 mb-4 shadow-sm">
              {weekDates.map(date => {
                const dayEntries = getEntriesForDate(date);
                const isSelected = formatDate(date) === formatDate(selectedDate);
                const isTodayDate = formatDate(date) === formatDate(new Date());
                return (
                  <button key={date.toISOString()} onClick={() => { setSelectedDate(date); setView("day"); }} className="flex-1 flex flex-col items-center gap-1 py-1">
                    <span className="text-[10px] font-medium" style={{ color: isTodayDate ? "#2563eb" : "#9ca3af" }}>{DAYS[date.getDay()]}</span>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: isSelected ? "#2563eb" : isTodayDate ? "#eff6ff" : "transparent" }}>
                      <span className="text-[13px] font-semibold" style={{ color: isSelected ? "#fff" : isTodayDate ? "#2563eb" : "#374151" }}>{date.getDate()}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {dayEntries.slice(0, 3).map((e, i) => <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sessionColor(e) }} />)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="space-y-3">
              {weekDates.map(date => {
                const dayEntries = getEntriesForDate(date);
                if (dayEntries.length === 0) return null;
                return (
                  <div key={date.toISOString()}>
                    <p className="text-xs font-bold text-gray-500 mb-1.5">{DAYS[date.getDay()]}, {MONTHS[date.getMonth()]} {date.getDate()}</p>
                    {dayEntries.map(entry => (
                      <div key={entry.id} className="bg-white rounded-xl p-3 mb-1.5 shadow-sm" style={{ borderLeft: `4px solid ${sessionColor(entry)}` }}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900 flex-1">{entry.client_initials}</span>
                          <span className="text-sm">{entry.is_telehealth ? "📹" : "📍"}</span>
                        </div>
                        {entry.start_time && <p className="text-xs text-gray-500 mt-0.5">{entry.start_time}</p>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MONTH VIEW */}
        {view === "month" && (
          <div className="p-4">
            <div className="flex mb-1">
              {DAYS.map(d => <span key={d} className="flex-1 text-center text-[11px] font-semibold text-gray-400 py-1">{d}</span>)}
            </div>
            <div className="flex flex-wrap">
              {monthDays.map((date, i) => {
                if (!date) return <div key={i} style={{ width: "14.28%" }} className="aspect-square" />;
                const dayEntries = getEntriesForDate(date);
                const isSelected = formatDate(date) === formatDate(selectedDate);
                const isTodayDate = formatDate(date) === formatDate(new Date());
                return (
                  <button key={i} onClick={() => { setSelectedDate(date); setView("day"); }} style={{ width: "14.28%" }} className="aspect-square flex flex-col items-center pt-1">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: isSelected || isTodayDate ? "#2563eb" : "transparent" }}>
                      <span className="text-xs font-medium" style={{ color: isSelected || isTodayDate ? "#fff" : "#374151" }}>{date.getDate()}</span>
                    </div>
                    <div className="flex gap-0.5 mt-1">
                      {dayEntries.slice(0, 3).map((e, j) => <span key={j} className="w-1 h-1 rounded-full" style={{ backgroundColor: sessionColor(e) }} />)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
              {[
                { color: "#2563eb", label: "In Person" },
                { color: "#7c3aed", label: "Telehealth" },
                { color: "#d97706", label: "Supervision" },
                { color: "#16a34a", label: "Completed" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[11px] text-gray-500">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
