"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type RiskItem = {
  risk: "low" | "medium" | "high";
};

export default function RiskDistributionChart({
  data,
}: {
  data: RiskItem[];
}) {
  const counts = {
    low: 0,
    medium: 0,
    high: 0,
  };

  data.forEach((item) => {
    counts[item.risk]++;
  });

  const chartData = [
    {
      name: "Low",
      value: counts.low,
      color: "#16a34a",
    },
    {
      name: "Medium",
      value: counts.medium,
      color: "#f59e0b",
    },
    {
      name: "High",
      value: counts.high,
      color: "#dc2626",
    },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: 320,
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 20,
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 20,
        }}
      >
        Risk Distribution
      </h2>

      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            outerRadius={90}
            label
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.color}
              />
            ))}
          </Pie>

          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}