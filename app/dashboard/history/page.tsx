"use client";

import { useEffect, useState } from "react";
import { getGlobalHistory, HistoryItem } from "@/lib/timeline/getGlobalHistory";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    client: "",
    date: "",
    type: "",
    staff: "",
  });

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);

    const data = await getGlobalHistory();

    setHistory(data);
    setLoading(false);
  }

  const filteredHistory = history.filter((item) => {
    if (filters.type && item.type !== filters.type) return false;
    if (filters.date) {
      const itemDate = new Date(item.created_at).toISOString().split("T")[0];
      if (itemDate !== filters.date) return false;
    }
    return true;
  });

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">History</h2>

      <p className="text-gray-600 mb-6">
        Review all clinical records across sessions, behaviors, and programs.
      </p>

      {/* FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <select
          className="border p-3 rounded-lg"
          value={filters.type}
          onChange={(e) =>
            setFilters({ ...filters, type: e.target.value })
          }
        >
          <option value="">All Types</option>
          <option value="session">Sessions</option>
          <option value="behavior">Behaviors</option>
          <option value="program">Programs</option>
        </select>

        <input
          type="date"
          className="border p-3 rounded-lg"
          value={filters.date}
          onChange={(e) =>
            setFilters({ ...filters, date: e.target.value })
          }
        />
      </div>

      {/* CONTENT */}
      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : filteredHistory.length === 0 ? (
          <p className="text-gray-500">No records found.</p>
        ) : (
          filteredHistory.map((item) => (
            <div key={item.id} className="p-3 border rounded-lg bg-gray-50">
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-gray-500">
                {item.type} •{" "}
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}