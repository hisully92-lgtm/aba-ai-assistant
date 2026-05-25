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

export type RiskTrendPoint = {
  date: string;
  score: number;
};

type Props = {
  data: RiskTrendPoint[];
};

export default function RiskTrendChart({ data }: Props) {
  return (
    <div className="w-full bg-white border border-gray-200 rounded-xl p-4">
      <h2 className="text-lg font-bold mb-4">Risk Trend Analysis</h2>

      {data.length === 0 ? (
        <p className="text-gray-400 text-sm">No risk data available.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#dc2626"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}