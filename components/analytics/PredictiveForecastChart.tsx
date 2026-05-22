"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Props = {
  data: {
    forecastCurve: {
      day: string;
      probability: number;
    }[];
  }[];
};

export default function PredictiveForecastChart({ data }: Props) {
  // flatten all forecast curves into one trend line
  const merged = data.flatMap((d) => d.forecastCurve);

  return (
    <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
      <h3 style={{ fontWeight: 700, marginBottom: 12 }}>
        🧠 Predictive Risk Forecast (7-Day)
      </h3>

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={merged}>
            <XAxis dataKey="day" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="probability"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}