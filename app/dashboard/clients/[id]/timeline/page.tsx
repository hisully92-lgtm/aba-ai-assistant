"use client";

import { useEffect, useState } from "react";
import { getClientTimeline, TimelineItem } from "@/lib/timeline/getClientTimeline";

export default function ClientTimelinePage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const data = await getClientTimeline(clientId);
    setTimeline(data);
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">Client Timeline</h2>

      <p className="text-gray-600 mb-6">
        Full chronological history of sessions, behaviors, and programs.
      </p>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : timeline.length === 0 ? (
        <p className="text-gray-500">No data yet.</p>
      ) : (
        <div className="space-y-3">
          {timeline.map((item) => (
            <div key={item.id} className="p-3 border rounded-lg bg-gray-50">
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-gray-500">
                {item.type} •{" "}
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}