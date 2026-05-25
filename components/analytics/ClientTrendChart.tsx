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

export type TrendPoint = {
  week: string;
  score: number;
};

type Props = {
  data: TrendPoint[];
};

export default function ClientTrendChart({ data }: Props) {
  return (
    <div className="w-full bg-white border border-gray-200 rounded-xl p-4">
      <h2 className="text-lg font-bold mb-4">Client Improvement Trend</h2>

      {data.length === 0 ? (
        <p className="text-gray-400 text-sm">No session data available.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#2563eb"
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