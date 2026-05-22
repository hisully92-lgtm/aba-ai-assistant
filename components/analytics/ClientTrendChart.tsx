"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type TrendPoint = {
  week: string;
  score: number;
};

type Props = {
  data: TrendPoint[];
};

export default function ClientTrendChart({
  data,
}: Props) {
  return (
    <div
      style={{
        width: "100%",
        height: 320,
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h2
        style={{
          marginBottom: 16,
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        Client Improvement Trend
      </h2>

      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="week" />

          <YAxis />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="score"
            stroke="#2563eb"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}