"use client";

import { useEffect, useState } from "react";
import {
  getClientTimeline,
  GroupedTimeline,
} from "@/lib/timeline/getClientTimeline";

export default function ClientTimelinePage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [timeline, setTimeline] = useState<GroupedTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTimeline();
  }, [clientId]);

  async function loadTimeline() {
    setLoading(true);
    setError(null);

    try {
      const data = await getClientTimeline(clientId);
      setTimeline(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load timeline.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Client Timeline</h2>
        <p className="text-gray-600">
          Chronological clinical record grouped by day.
        </p>
      </div>

      {/* STATES */}
      {loading && <p className="text-gray-500">Loading timeline...</p>}

      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && timeline.length === 0 && (
        <p className="text-gray-500">No records yet.</p>
      )}

      {/* TIMELINE (GROUPED) */}
      {!loading && !error && timeline.length > 0 && (
        <div className="space-y-8">
          {timeline.map((group) => (
            <div key={group.date}>
              {/* DATE HEADER */}
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  {group.date}
                </h3>
                <div className="h-px bg-gray-200 mt-1" />
              </div>

              {/* ITEMS */}
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-medium">{item.title}</p>

                      <span className="text-xs px-2 py-1 rounded-full bg-white border capitalize">
                        {item.type}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(item.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}