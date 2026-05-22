"use client";

import ClientProgressChart from "@/components/analytics/ClientProgressChart";

type Props = {
  data?: { date: string; score: number }[];
};

export default function ClientProgressSection({
  data,
}: Props) {
  const fallbackData = [
    { date: "Week 1", score: 40 },
    { date: "Week 2", score: 55 },
    { date: "Week 3", score: 60 },
    { date: "Week 4", score: 72 },
  ];

  return (
    <div style={{ marginTop: 40 }}>
      <h2>Client Progress Graph</h2>

      <ClientProgressChart data={data || fallbackData} />
    </div>
  );
}