"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* ---------------- TYPES ---------------- */

type Client = { id: string; full_name: string };

type BehaviorEntry = {
  behavior_name: string;
  created_at: string;
  frequency: number;
};

/* ---------------- CONSTANTS ---------------- */

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------------- PAGE ---------------- */

export default function AnalyticsDashboard() {
  /* ---------------- GLOBAL STATE ---------------- */

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  const [dateRange, setDateRange] = useState("6m");
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  /* ---------------- ORG STATS ---------------- */

  const [orgStats, setOrgStats] = useState({
    totalClients: 0,
    sessions: 0,
    behaviors: 0,
    programs: 0,
    incidents: 0,
    masteredGoals: 0,
    activeGoals: 0,
  });

  const [outcomeData, setOutcomeData] = useState<any[]>([]);
  const [domainData, setDomainData] = useState<any[]>([]);

  /* ---------------- CLIENT TRENDS ---------------- */

  const [masteryVelocity, setMasteryVelocity] = useState<any[]>([]);
  const [behaviorTrend, setBehaviorTrend] = useState<any[]>([]);
  const [sessionAttendance, setSessionAttendance] = useState<any[]>([]);
  const [promptTrend, setPromptTrend] = useState<any[]>([]);

  const [summary, setSummary] = useState<any>({
    totalMastered: 0,
    avgMasteryPerMonth: 0,
    behaviorReduction: 0,
    attendanceRate: 0,
    promptProgress: "",
  });

  /* ---------------- HEATMAP ---------------- */

  const [behaviors, setBehaviors] = useState<BehaviorEntry[]>([]);
  const [behaviorNames, setBehaviorNames] = useState<string[]>([]);
  const [selectedBehavior, setSelectedBehavior] = useState("all");

  const [viewMode, setViewMode] = useState<"heatmap" | "scatterplot">("heatmap");

  const [heatmapData, setHeatmapData] = useState<
    Record<string, Record<number, number>>
  >({});

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadClientData();
      loadBehaviorData();
    }
  }, [selectedClientId, dateRange]);

  useEffect(() => {
    buildHeatmap();
  }, [behaviors, selectedBehavior]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientsData }, orgData] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      loadOrgData(),
    ]);

    setClients(clientsData ?? []);
    setLoading(false);
  }

  /* ---------------- ORG DATA ---------------- */

  async function loadOrgData() {
    const monthsBack = parseRange(dateRange);
    const start = getStartDate(monthsBack);

    const [
      { count: clients },
      { count: sessions },
      { count: behaviors },
      { count: programs },
      { count: incidents },
      { data: goals },
    ] = await Promise.all([
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("sessions").select("*", { count: "exact", head: true }).gte("created_at", start),
      supabase.from("behaviors").select("*", { count: "exact", head: true }).gte("created_at", start),
      supabase.from("programs").select("*", { count: "exact", head: true }).gte("created_at", start),
      supabase.from("incident_reports").select("*", { count: "exact", head: true }).gte("created_at", start),
      supabase.from("client_goals").select("status, domain"),
    ]);

    const mastered = (goals ?? []).filter((g: any) => g.status === "mastered").length;
    const active = (goals ?? []).filter((g: any) => g.status === "active").length;

    setOrgStats({
      totalClients: clients ?? 0,
      sessions: sessions ?? 0,
      behaviors: behaviors ?? 0,
      programs: programs ?? 0,
      incidents: incidents ?? 0,
      masteredGoals: mastered,
      activeGoals: active,
    });

    setOutcomeData([
      { name: "Mastered", value: mastered, color: "#16a34a" },
      { name: "Active", value: active, color: "#2563eb" },
      { name: "On Hold", value: (goals ?? []).filter((g: any) => g.status === "on_hold").length, color: "#f59e0b" },
      { name: "Discontinued", value: (goals ?? []).filter((g: any) => g.status === "discontinued").length, color: "#dc2626" },
    ].filter((d) => d.value > 0));

    const domainMap: Record<string, number> = {};
    (goals ?? []).forEach((g: any) => {
      if (!g.domain) return;
      domainMap[g.domain] = (domainMap[g.domain] ?? 0) + 1;
    });

    setDomainData(Object.entries(domainMap).map(([domain, count]) => ({
      domain,
      count,
    })));
  }

  /* ---------------- CLIENT DATA ---------------- */

  async function loadClientData() {
    setDataLoading(true);

    const monthsBack = parseRange(dateRange);
    const start = getStartDate(monthsBack);

    const [{ data: programs }, { data: behaviors }, { data: sessions }, { data: prompts }] =
      await Promise.all([
        supabase.from("programs").select("*").eq("client_id", selectedClientId).gte("created_at", start),
        supabase.from("behaviors").select("*").eq("client_id", selectedClientId).gte("created_at", start),
        supabase.from("sessions").select("*").eq("client_id", selectedClientId).gte("created_at", start),
        supabase.from("prompt_fading_logs").select("*").eq("client_id", selectedClientId).gte("session_date", start),
      ]);

    /* mastery */
    const byMonth: Record<string, number> = {};
    let cumulative = 0;

    (programs ?? []).forEach((p: any) => {
      const month = p.created_at.slice(0, 7);
      const pct = parseInt(p.trial_data?.match(/\d+/)?.[0] ?? "0");

      if (pct >= 80) {
        byMonth[month] = (byMonth[month] ?? 0) + 1;
      }
    });

    const velocity = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, v]) => {
        cumulative += v;
        return { month: m, mastered: v, cumulative };
      });

    setMasteryVelocity(velocity);

    /* behavior trend */
    const behMap: Record<string, number> = {};
    (behaviors ?? []).forEach((b: any) => {
      const m = b.created_at.slice(0, 7);
      behMap[m] = (behMap[m] ?? 0) + (b.frequency ?? 1);
    });

    const behTrend = Object.entries(behMap).map(([m, v]) => ({
      month: m,
      frequency: v,
    }));

    setBehaviorTrend(behTrend);

    /* attendance */
    const sessionMap: Record<string, { c: number; x: number }> = {};
    (sessions ?? []).forEach((s: any) => {
      const m = (s.date ?? s.created_at).slice(0, 7);
      const cur = sessionMap[m] ?? { c: 0, x: 0 };

      sessionMap[m] = {
        c: cur.c + (s.status === "completed" ? 1 : 0),
        x: cur.x + (s.status === "cancelled" ? 1 : 0),
      };
    });

    const attendance = Object.entries(sessionMap).map(([m, v]) => ({
      month: m,
      rate: Math.round((v.c / (v.c + v.x || 1)) * 100),
    }));

    setSessionAttendance(attendance);

    /* prompt trend */
    const PROMPT: Record<string, number> = {
      "FP": 1,
      "PP": 2,
      "M": 3,
      "G": 4,
      "P": 5,
      "V": 6,
      "I": 7,
    };

    setPromptTrend(
      (prompts ?? []).map((p: any) => ({
        date: p.session_date,
        level: PROMPT[p.current_prompt_level] ?? 0,
        label: p.current_prompt_level,
      }))
    );

    setDataLoading(false);
  }

  /* ---------------- HEATMAP ---------------- */

  async function loadBehaviorData() {
    const { data } = await supabase
      .from("behaviors")
      .select("*")
      .eq("client_id", selectedClientId);

    const entries = (data ?? []) as BehaviorEntry[];

    setBehaviors(entries);
    setBehaviorNames([...new Set(entries.map((b) => b.behavior_name))]);
  }

  function buildHeatmap() {
    const filtered =
      selectedBehavior === "all"
        ? behaviors
        : behaviors.filter((b) => b.behavior_name === selectedBehavior);

    const map: Record<string, Record<number, number>> = {};

    DAYS.forEach((d) => {
      map[d] = {};
      HOURS.forEach((h) => (map[d][h] = 0));
    });

    filtered.forEach((b) => {
      const d = DAYS[new Date(b.created_at).getDay()];
      const h = new Date(b.created_at).getHours();
      map[d][h] += b.frequency ?? 1;
    });

    setHeatmapData(map);
  }

  /* ---------------- HELPERS ---------------- */

  function parseRange(r: string) {
    return r === "3m" ? 3 : r === "6m" ? 6 : r === "12m" ? 12 : 24;
  }

  function getStartDate(months: number) {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d.toISOString().split("T")[0];
  }

  function maxHeat() {
    return Math.max(
      ...Object.values(heatmapData).flatMap((d) => Object.values(d)),
      1
    );
  }

  function color(v: number) {
    const m = maxHeat();
    if (!v) return "bg-gray-100";
    const p = v / m;
    if (p > 0.8) return "bg-red-600";
    if (p > 0.6) return "bg-red-400";
    if (p > 0.4) return "bg-orange-400";
    if (p > 0.2) return "bg-yellow-300";
    return "bg-yellow-100";
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics Dashboard" />

      {/* CLIENT + RANGE */}
      <div className="flex gap-2 flex-wrap">
        <select
          className="border px-3 py-2 rounded"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          <option value="">Select client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>

        {["3m", "6m", "12m", "24m"].map((r) => (
          <button
            key={r}
            onClick={() => setDateRange(r)}
            className={`px-3 py-1 rounded border ${
              dateRange === r ? "bg-blue-600 text-white" : ""
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* ORG STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(orgStats).map(([k, v]) => (
          <div key={k} className="border p-3 rounded text-center">
            <p className="text-xl font-bold">{v}</p>
            <p className="text-xs text-gray-500">{k}</p>
          </div>
        ))}
      </div>

      {/* CLIENT CHARTS */}
      {selectedClientId && !dataLoading && (
        <>
          <Section title="Skill Mastery">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={masteryVelocity}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area dataKey="cumulative" stroke="#16a34a" fill="#dcfce7" />
              </AreaChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Behavior Trend">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={behaviorTrend}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line dataKey="frequency" stroke="#dc2626" />
              </LineChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Attendance">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={sessionAttendance}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line dataKey="rate" stroke="#8b5cf6" />
              </LineChart>
            </ResponsiveContainer>
          </Section>

          {/* HEATMAP */}
          <Section title="Behavior Heatmap">
            <div className="flex gap-1 flex-wrap mb-3">
              <select
                value={selectedBehavior}
                onChange={(e) => setSelectedBehavior(e.target.value)}
                className="border px-2 py-1"
              >
                <option value="all">All behaviors</option>
                {behaviorNames.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>

              <button
                onClick={() =>
                  setViewMode(viewMode === "heatmap" ? "scatterplot" : "heatmap")
                }
                className="border px-2 py-1"
              >
                Toggle View
              </button>
            </div>

            <div className="flex gap-1">
              {DAYS.map((d) => (
                <div key={d} className="flex flex-col items-center">
                  <div className="text-xs">{d}</div>
                  {HOURS.map((h) => {
                    const v = heatmapData[d]?.[h] ?? 0;
                    return (
                      <div
                        key={h}
                        className={`w-4 h-4 ${color(v)}`}
                        title={`${d} ${h}:00`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}