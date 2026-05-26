"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

type Client = { id: string; full_name: string };
type BehaviorEntry = {
  behavior_name: string;
  created_at: string;
  frequency: number;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BehaviorHeatmapPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [behaviors, setBehaviors] = useState<BehaviorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedBehavior, setSelectedBehavior] = useState("all");
  const [heatmapData, setHeatmapData] = useState<Record<string, Record<number, number>>>({});
  const [behaviorNames, setBehaviorNames] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"heatmap" | "scatterplot">("heatmap");

  useEffect(() => { init(); }, []);
  useEffect(() => { if (selectedClientId) loadBehaviors(); }, [selectedClientId]);
  useEffect(() => { buildHeatmap(); }, [behaviors, selectedBehavior]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("clients").select("id, full_name").eq("created_by", user.id);
    setClients(data ?? []);
    setLoading(false);
  }

  async function loadBehaviors() {
    setDataLoading(true);
    const { data } = await supabase.from("behaviors")
      .select("behavior_name, created_at, frequency")
      .eq("client_id", selectedClientId)
      .order("created_at", { ascending: true });

    const entries = data ?? [];
    setBehaviors(entries);
    const names = Array.from(new Set(entries.map((b: any) => b.behavior_name)));
    setBehaviorNames(names);
    setDataLoading(false);
  }

  function buildHeatmap() {
    const filtered = selectedBehavior === "all" ? behaviors : behaviors.filter((b) => b.behavior_name === selectedBehavior);
    const map: Record<string, Record<number, number>> = {};

    DAYS.forEach((day) => {
      map[day] = {};
      HOURS.forEach((hour) => { map[day][hour] = 0; });
    });

    filtered.forEach((b) => {
      const date = new Date(b.created_at);
      const day = DAYS[date.getDay()];
      const hour = date.getHours();
      map[day][hour] = (map[day][hour] ?? 0) + (b.frequency ?? 1);
    });

    setHeatmapData(map);
  }

  function maxValue() {
    let max = 0;
    Object.values(heatmapData).forEach((hours) => {
      Object.values(hours).forEach((val) => { if (val > max) max = val; });
    });
    return max;
  }

  function cellColor(value: number, max: number) {
    if (max === 0 || value === 0) return "bg-gray-100";
    const intensity = value / max;
    if (intensity > 0.8) return "bg-red-600";
    if (intensity > 0.6) return "bg-red-400";
    if (intensity > 0.4) return "bg-orange-400";
    if (intensity > 0.2) return "bg-yellow-300";
    return "bg-yellow-100";
  }

  // Find peak time
  function peakTime() {
    let maxVal = 0;
    let peakDay = "";
    let peakHour = 0;
    Object.entries(heatmapData).forEach(([day, hours]) => {
      Object.entries(hours).forEach(([hour, val]) => {
        if (val > maxVal) { maxVal = val; peakDay = day; peakHour = parseInt(hour); }
      });
    });
    if (!maxVal) return "No data";
    return `${peakDay} ${peakHour}:00 — ${peakHour + 1}:00 (${maxVal} occurrences)`;
  }

  const max = maxValue();

  // Scatterplot data
  const scatterPoints = behaviors
    .filter((b) => selectedBehavior === "all" || b.behavior_name === selectedBehavior)
    .map((b) => {
      const date = new Date(b.created_at);
      return { day: date.getDay(), hour: date.getHours(), freq: b.frequency ?? 1, name: b.behavior_name, date: date.toLocaleDateString() };
    });

  return (
    <div className="space-y-6">
      <PageHeader title="Behavior Heatmap">
        <p className="text-gray-500 text-sm">Visualize when behaviors occur by day and time.</p>
      </PageHeader>

      <div className="flex flex-wrap gap-3 items-center">
        <select value={selectedClientId} onChange={(e) => { setSelectedClientId(e.target.value); setBehaviors([]); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">Select client...</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        {behaviorNames.length > 0 && (
          <select value={selectedBehavior} onChange={(e) => setSelectedBehavior(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="all">All Behaviors</option>
            {behaviorNames.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
          {["heatmap", "scatterplot"].map((m) => (
            <button key={m} onClick={() => setViewMode(m as any)}
              className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${viewMode === m ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {!selectedClientId && (
        <Section title="Select a Client">
          <p className="text-gray-400 text-sm">Choose a client to view their behavior heatmap.</p>
        </Section>
      )}

      {selectedClientId && dataLoading && (
        <div className="flex items-center gap-3 py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading behavior data...</p>
        </div>
      )}

      {selectedClientId && !dataLoading && behaviors.length === 0 && (
        <Section title="No Data">
          <p className="text-gray-400 text-sm">No behavior data logged for this client yet.</p>
        </Section>
      )}

      {selectedClientId && !dataLoading && behaviors.length > 0 && (
        <>
          {/* PEAK TIME */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-orange-700">🔥 Peak Behavior Time: {peakTime()}</p>
            <p className="text-xs text-orange-600 mt-1">Consider scheduling activities, transitions, or support during this period.</p>
          </div>

          {viewMode === "heatmap" && (
            <Section title="Day × Time Heatmap">
              <div className="overflow-x-auto">
                <div className="min-w-max">
                  {/* HOUR LABELS */}
                  <div className="flex ml-10 mb-1">
                    {[0, 6, 12, 18, 23].map((h) => (
                      <div key={h} style={{ width: `${(h === 0 ? 6 : h - (h === 23 ? 18 : h === 18 ? 12 : h === 12 ? 6 : 0)) * (100 / 24)}%` }}
                        className="text-xs text-gray-400 text-center">
                        {h}:00
                      </div>
                    ))}
                  </div>

                  {DAYS.map((day) => (
                    <div key={day} className="flex items-center gap-1 mb-1">
                      <span className="text-xs text-gray-500 w-10 text-right pr-2">{day}</span>
                      <div className="flex gap-0.5">
                        {HOURS.map((hour) => {
                          const val = heatmapData[day]?.[hour] ?? 0;
                          return (
                            <div key={hour} title={`${day} ${hour}:00 — ${val} occurrences`}
                              className={`w-4 h-6 rounded-sm cursor-pointer transition-all hover:scale-110 ${cellColor(val, max)}`} />
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* LEGEND */}
                  <div className="flex items-center gap-2 mt-3 ml-10">
                    <span className="text-xs text-gray-400">Low</span>
                    {["bg-yellow-100", "bg-yellow-300", "bg-orange-400", "bg-red-400", "bg-red-600"].map((c) => (
                      <div key={c} className={`w-4 h-4 rounded ${c}`} />
                    ))}
                    <span className="text-xs text-gray-400">High</span>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {viewMode === "scatterplot" && (
            <Section title="Behavior Scatterplot">
              <div className="relative border border-gray-100 rounded-xl bg-gray-50 overflow-hidden" style={{ height: 320 }}>
                {/* Y axis labels */}
                <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between py-4">
                  {DAYS.map((d) => <span key={d} className="text-xs text-gray-400 text-right pr-1">{d}</span>)}
                </div>
                {/* X axis labels */}
                <div className="absolute bottom-0 left-10 right-0 flex justify-between px-2">
                  {[0, 6, 12, 18, 23].map((h) => <span key={h} className="text-xs text-gray-400">{h}:00</span>)}
                </div>
                {/* POINTS */}
                <div className="absolute left-10 right-0 top-0 bottom-6">
                  {scatterPoints.map((point, i) => {
                    const x = (point.hour / 24) * 100;
                    const y = (point.day / 6) * 100;
                    const size = Math.min(20, 6 + point.freq * 2);
                    return (
                      <div key={i} title={`${point.name} — ${point.date} ${point.hour}:00`}
                        className="absolute rounded-full bg-red-500 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          width: size,
                          height: size,
                          transform: "translate(-50%, -50%)",
                        }} />
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Circle size = frequency · Hover for details</p>
            </Section>
          )}
        </>
      )}
    </div>
  );
}