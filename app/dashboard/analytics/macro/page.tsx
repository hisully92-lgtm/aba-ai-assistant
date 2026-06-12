"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

/* =========================
   TYPES
========================= */

type Client = {
  id: string;
  full_name: string;
  diagnosis?: string | null;
};

type MonthMap<T = number> = Record<string, T>;

/* =========================
   CONSTANTS (NO DUPLICATION)
========================= */

const RANGE_MAP: Record<string, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "12m": 12,
  "24m": 24,
};

const PROMPT_LEVELS = [
  "Full Physical (FP)",
  "Partial Physical (PP)",
  "Model (M)",
  "Gesture (G)",
  "Positional (P)",
  "Vocal (V)",
  "Independent (I)",
] as const;

const PROMPT_INDEX = Object.fromEntries(
  PROMPT_LEVELS.map((p, i) => [p, i])
) as Record<string, number>;

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6"];

/* =========================
   HELPERS (REMOVES DUPLICATES)
========================= */

function getStartDate(range: string) {
  const d = new Date();
  d.setMonth(d.getMonth() - (RANGE_MAP[range] ?? 3));
  return d.toISOString().split("T")[0];
}

function monthKey(date: string) {
  return date?.slice(0, 7);
}

function groupByMonth<T extends Record<string, any>>(
  arr: T[],
  dateField: string,
  valueFn: (item: T) => number = () => 1
): MonthMap {
  return (arr ?? []).reduce((acc: MonthMap, item) => {
    const month = monthKey(item[dateField]);
    if (!month) return acc;
    acc[month] = (acc[month] ?? 0) + valueFn(item);
    return acc;
  }, {});
}

function toSortedChart<T>(map: MonthMap<T>) {
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, value]) => ({ month, value }));
}

/* =========================
   MAIN COMPONENT
========================= */

export default function MacroAnalyticsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [range, setRange] = useState("6m");

  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // GLOBAL
  const [sessionTrend, setSessionTrend] = useState<any[]>([]);
  const [behaviorTrend, setBehaviorTrend] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<any[]>([]);

  // CLIENT-SPECIFIC
  const [masteryVelocity, setMasteryVelocity] = useState<any[]>([]);
  const [promptTrend, setPromptTrend] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    loadData();
  }, [clientId, range]);

  /* =========================
     INIT CLIENT LIST
========================= */

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data } = await supabase
      .from("clients")
      .select("id, full_name, diagnosis")
      .eq("created_by", auth.user.id);

    setClients(data ?? []);
    setLoading(false);
  }

  /* =========================
     LOAD ALL DATA (DEDUPED)
========================= */

  async function loadData() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    setDataLoading(true);

    const startStr = getStartDate(range);

    const [
      { data: sessions },
      { data: behaviors },
      { data: programs },
      { data: goals },
      { data: promptLogs },
    ] = await Promise.all([
      supabase.from("sessions").select("*").gte("created_at", startStr),
      supabase.from("behaviors").select("*").gte("created_at", startStr),
      supabase.from("programs").select("*").gte("created_at", startStr),
      supabase.from("client_goals").select("*"),
      supabase
        .from("prompt_fading_logs")
        .select("session_date, current_prompt_level")
        .eq("client_id", clientId || "")
        .order("session_date"),
    ]);

    /* =========================
       GLOBAL METRICS (NO DUPLICATION)
    ========================= */

    setSessionTrend(
      toSortedChart(groupByMonth(sessions ?? [], "created_at"))
        .map((d) => ({ month: d.month, sessions: d.value }))
    );

    setBehaviorTrend(
      toSortedChart(
        groupByMonth(behaviors ?? [], "created_at", (b) => b.frequency ?? 1)
      ).map((d) => ({ month: d.month, behaviors: d.value }))
    );

    setOutcomes([
      {
        name: "Mastered",
        value: goals?.filter((g: any) => g.status === "mastered").length ?? 0,
      },
      {
        name: "Active",
        value: goals?.filter((g: any) => g.status === "active").length ?? 0,
      },
      {
        name: "On Hold",
        value: goals?.filter((g: any) => g.status === "on_hold").length ?? 0,
      },
    ]);

    /* =========================
       CLIENT ANALYTICS (DEDUPED)
    ========================= */

    if (clientId) {
      const velocityMap = new Map<string, number>();

      (programs ?? []).forEach((p: any) => {
        const pct = parseInt(p.trial_data?.match(/(\d+)/)?.[1] ?? "0");
        const mastery = parseInt(p.mastery_criteria?.match(/(\d+)/)?.[1] ?? "80");

        if (pct >= mastery) {
          const m = monthKey(p.created_at);
          velocityMap.set(m, (velocityMap.get(m) ?? 0) + 1);
        }
      });

      let cum = 0;
      const velocity = Array.from(velocityMap.entries())
        .sort()
        .map(([month, value]) => ({
          month,
          value,
          cumulative: (cum += value),
        }));

      setMasteryVelocity(velocity);

      setPromptTrend(
        (promptLogs ?? []).map((p: any) => ({
          date: p.session_date,
          level: PROMPT_INDEX[p.current_prompt_level] ?? 0,
          label: p.current_prompt_level,
        }))
      );

      const attendanceMap = groupByMonth(
        sessions ?? [],
        "created_at",
        (s) => (s.status === "completed" ? 1 : 0)
      );

      setAttendance(toSortedChart(attendanceMap));
    }

    setDataLoading(false);
  }

  /* =========================
     UI
========================= */

  return (
    <div className="space-y-6">
      <PageHeader title="Macro Analytics">
        <div className="flex gap-2">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="border px-3 py-2 rounded-lg text-sm"
          >
            <option value="">Global View</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>

          {["3m", "6m", "12m"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 text-xs rounded ${
                range === r ? "bg-blue-600 text-white" : "text-gray-500"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </PageHeader>

      {loading && <p>Loading...</p>}

      {!loading && (
        <>
          {/* GLOBAL CHARTS */}
          <Section title="Session Trends">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={sessionTrend}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line dataKey="sessions" stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Behavior Trends">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={behaviorTrend}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="behaviors" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {/* CLIENT ONLY */}
          {clientId && (
            <>
              <Section title="Mastery Velocity">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={masteryVelocity}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area dataKey="cumulative" fill="#dcfce7" stroke="#16a34a" />
                  </AreaChart>
                </ResponsiveContainer>
              </Section>

              <Section title="Prompt Progress">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={promptTrend}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line dataKey="level" stroke="#f97316" />
                  </LineChart>
                </ResponsiveContainer>
              </Section>
            </>
          )}

          {/* OUTCOMES */}
          <Section title="Goal Outcomes">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={outcomes} dataKey="value" cx="50%" cy="50%" outerRadius={70}>
                  {outcomes.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </Section>
        </>
      )}
    </div>
  );
}