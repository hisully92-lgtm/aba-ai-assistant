"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type ChartPoint = {
  date: string;
  frequency: number;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data: logs, error } = await supabase
        .from("behavior_logs")
        .select("frequency, recorded_at");

      if (error) {
        console.error(error);
        return;
      }

      if (!Array.isArray(logs)) return;

      const grouped: Record<string, number> = {};

      for (const log of logs) {
        if (!log?.recorded_at) continue;

        const date = new Date(log.recorded_at).toLocaleDateString();

        grouped[date] = (grouped[date] || 0) + (log.frequency ?? 0);
      }

      const chartData = Object.entries(grouped).map(([date, frequency]) => ({
        date,
        frequency,
      }));

      setData(chartData);
    }

    loadData();
  }, []);

  return (
    <div style={{ width: "100%", height: 400 }}>
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="frequency" stroke="#2563eb" />
    </LineChart>
  </ResponsiveContainer>
</div>
  );
}