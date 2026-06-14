import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";

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

export default function CalendarScreen() {
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  function formatDate(date: Date) {
    return date.toISOString().split("T")[0];
  }

  function getEntriesForDate(date: Date) {
    return entries.filter(e => e.date === formatDate(date));
  }

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Schedule</Text>
        <View style={styles.viewToggle}>
          {(["day", "week", "month"] as const).map(v => (
            <TouchableOpacity key={v} style={[styles.viewBtn, view === v && styles.viewBtnActive]} onPress={() => setView(v)}>
              <Text style={[styles.viewBtnText, view === v && styles.viewBtnTextActive]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.nav}>
        <TouchableOpacity onPress={() => navigate(-1)} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>
          {view === "day"
            ? `${DAYS[selectedDate.getDay()]}, ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}`
            : view === "week"
            ? `Week of ${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()}`
            : `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`}
        </Text>
        <TouchableOpacity onPress={() => navigate(1)} style={styles.navBtn}>
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          {view === "day" && (
            <View style={styles.dayView}>
              {isToday && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>Today</Text>
                </View>
              )}
              {todayEntries.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>📅</Text>
                  <Text style={styles.emptyText}>No sessions scheduled</Text>
                </View>
              ) : (
                todayEntries.map(entry => (
                  <View key={entry.id} style={[styles.entryCard, { borderLeftColor: sessionColor(entry) }]}>
                    <View style={styles.entryHeader}>
                      <View style={[styles.entryDot, { backgroundColor: sessionColor(entry) }]} />
                      <Text style={styles.entryClient}>{entry.client_initials}</Text>
                      <Text style={styles.entryType}>{entry.is_telehealth ? "📹 Telehealth" : "📍 In Person"}</Text>
                      {entry.session_type === "Supervision" && (
                        <View style={styles.supBadge}><Text style={styles.supBadgeText}>Supervision</Text></View>
                      )}
                    </View>
                    {entry.start_time && (
                      <Text style={styles.entryTime}>{entry.start_time}{entry.end_time ? ` → ${entry.end_time}` : ""}</Text>
                    )}
                    {entry.bcba_name && <Text style={styles.entrySub}>👩‍⚕️ {entry.bcba_name}</Text>}
                    {entry.is_telehealth && entry.telehealth_link ? (
                      <Text style={styles.entryLink}>🔗 {entry.telehealth_link}</Text>
                    ) : entry.address ? (
                      <Text style={styles.entrySub}>📍 {entry.address}</Text>
                    ) : null}
                    <View style={[styles.statusPill, { backgroundColor: entry.status === "completed" ? "#dcfce7" : "#fef9c3" }]}>
                      <Text style={styles.statusPillText}>{entry.status}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {view === "week" && (
            <View style={styles.weekView}>
              <View style={styles.weekRow}>
                {weekDates.map(date => {
                  const dayEntries = getEntriesForDate(date);
                  const isSelected = formatDate(date) === formatDate(selectedDate);
                  const isTodayDate = formatDate(date) === formatDate(new Date());
                  return (
                    <TouchableOpacity key={date.toISOString()} style={styles.weekDay}
                      onPress={() => { setSelectedDate(date); setView("day"); }}>
                      <Text style={[styles.weekDayName, isTodayDate && styles.weekDayToday]}>{DAYS[date.getDay()]}</Text>
                      <View style={[styles.weekDayNum, isSelected && styles.weekDayNumSelected, isTodayDate && styles.weekDayNumToday]}>
                        <Text style={[styles.weekDayNumText, (isSelected || isTodayDate) && styles.weekDayNumTextActive]}>
                          {date.getDate()}
                        </Text>
                      </View>
                      <View style={styles.weekDots}>
                        {dayEntries.slice(0, 3).map((e, i) => (
                          <View key={i} style={[styles.dot, { backgroundColor: sessionColor(e) }]} />
                        ))}
                      </View>
                      {dayEntries.length > 0 && <Text style={styles.weekCount}>{dayEntries.length}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.weekSessions}>
                {weekDates.map(date => {
                  const dayEntries = getEntriesForDate(date);
                  if (dayEntries.length === 0) return null;
                  return (
                    <View key={date.toISOString()}>
                      <Text style={styles.weekDateLabel}>{DAYS[date.getDay()]}, {MONTHS[date.getMonth()]} {date.getDate()}</Text>
                      {dayEntries.map(entry => (
                        <View key={entry.id} style={[styles.entryCard, { borderLeftColor: sessionColor(entry) }]}>
                          <View style={styles.entryHeader}>
                            <Text style={styles.entryClient}>{entry.client_initials}</Text>
                            <Text style={styles.entryType}>{entry.is_telehealth ? "📹" : "📍"}</Text>
                          </View>
                          {entry.start_time && <Text style={styles.entryTime}>{entry.start_time}</Text>}
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {view === "month" && (
            <View style={styles.monthView}>
              <View style={styles.monthHeader}>
                {DAYS.map(d => <Text key={d} style={styles.monthDayName}>{d}</Text>)}
              </View>
              <View style={styles.monthGrid}>
                {monthDays.map((date, i) => {
                  if (!date) return <View key={i} style={styles.monthCell} />;
                  const dayEntries = getEntriesForDate(date);
                  const isSelected = formatDate(date) === formatDate(selectedDate);
                  const isTodayDate = formatDate(date) === formatDate(new Date());
                  return (
                    <TouchableOpacity key={i} style={styles.monthCell}
                      onPress={() => { setSelectedDate(date); setView("day"); }}>
                      <View style={[styles.monthDayNum, isSelected && styles.monthDaySelected, isTodayDate && styles.monthDayToday]}>
                        <Text style={[styles.monthDayText, (isSelected || isTodayDate) && { color: "#fff" }]}>
                          {date.getDate()}
                        </Text>
                      </View>
                      <View style={styles.monthDots}>
                        {dayEntries.slice(0, 3).map((e, j) => (
                          <View key={j} style={[styles.dot, { backgroundColor: sessionColor(e) }]} />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.legend}>
                {[
                  { color: "#2563eb", label: "In Person" },
                  { color: "#7c3aed", label: "Telehealth" },
                  { color: "#d97706", label: "Supervision" },
                  { color: "#16a34a", label: "Completed" },
                ].map(item => (
                  <View key={item.label} style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#1a2234", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  viewToggle: { flexDirection: "row", backgroundColor: "#2a3a54", borderRadius: 8, padding: 2 },
  viewBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  viewBtnActive: { backgroundColor: "#2563eb" },
  viewBtnText: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },
  viewBtnTextActive: { color: "#fff", fontWeight: "700" },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6", borderRadius: 18 },
  navBtnText: { fontSize: 22, color: "#374151", fontWeight: "300" },
  navTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  dayView: { padding: 16 },
  todayBadge: { backgroundColor: "#eff6ff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 12 },
  todayBadgeText: { color: "#2563eb", fontSize: 12, fontWeight: "600" },
  entryCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 4, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  entryHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  entryDot: { width: 8, height: 8, borderRadius: 4 },
  entryClient: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1 },
  entryType: { fontSize: 12, color: "#6b7280" },
  entryTime: { fontSize: 13, color: "#6b7280", marginBottom: 4 },
  entrySub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  entryLink: { fontSize: 12, color: "#2563eb", marginTop: 2 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 6 },
  statusPillText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  supBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  supBadgeText: { fontSize: 10, color: "#92400e", fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#9ca3af" },
  weekView: { padding: 16 },
  weekRow: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 8, marginBottom: 16 },
  weekDay: { flex: 1, alignItems: "center", gap: 4 },
  weekDayName: { fontSize: 10, color: "#9ca3af", fontWeight: "500" },
  weekDayToday: { color: "#2563eb" },
  weekDayNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  weekDayNumSelected: { backgroundColor: "#2563eb" },
  weekDayNumToday: { backgroundColor: "#eff6ff" },
  weekDayNumText: { fontSize: 13, color: "#374151", fontWeight: "600" },
  weekDayNumTextActive: { color: "#2563eb" },
  weekDots: { flexDirection: "row", gap: 2 },
  weekCount: { fontSize: 9, color: "#6b7280" },
  weekSessions: { gap: 8 },
  weekDateLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", marginTop: 12, marginBottom: 6 },
  monthView: { padding: 16 },
  monthHeader: { flexDirection: "row", marginBottom: 4 },
  monthDayName: { flex: 1, textAlign: "center", fontSize: 11, color: "#9ca3af", fontWeight: "600", paddingVertical: 4 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  monthCell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "flex-start", padding: 2 },
  monthDayNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  monthDaySelected: { backgroundColor: "#2563eb" },
  monthDayToday: { backgroundColor: "#2563eb" },
  monthDayText: { fontSize: 12, color: "#374151", fontWeight: "500" },
  monthDots: { flexDirection: "row", gap: 2, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { fontSize: 11, color: "#6b7280" },
});