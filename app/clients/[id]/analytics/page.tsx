"use client";

import { useEffect, useState } from "react";
import {
  getClientAnalytics,
  ClientAnalytics,
} from "@/lib/analytics/clientAnalytics";

import { generateClinicalInsights } from "@/lib/ai/generateClinicalInsights";

export default function ClientAnalyticsPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [data, setData] = useState<ClientAnalytics | null>(null);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [clientId]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      // 1. Load analytics
      const result = await getClientAnalytics(clientId);
      setData(result);

      // 2. Generate AI insights
      setInsightLoading(true);
      const ai = await generateClinicalInsights(result);
      setInsights(ai);
    } catch (err) {
      console.error(err);
      setError("Failed to load analytics.");
    } finally {
      setLoading(false);
      setInsightLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      {/* HEADER */}
      <h2 className="text-2xl font-bold mb-6">
        Client Progress Analytics
      </h2>

      {/* STATES */}
      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {/* MAIN CONTENT */}
      {!loading && !error && data && (
        <div className="space-y-6">

          {/* SESSIONS */}
          <div>
            <h3 className="font-semibold mb-2">
              Sessions Over Time
            </h3>

            {Object.entries(data.sessionsPerDay).map(
              ([day, count]) => (
                <div
                  key={day}
                  className="flex justify-between border-b py-1"
                >
                  <span>{day}</span>
                  <span>{count}</span>
                </div>
              )
            )}
          </div>

          {/* BEHAVIORS */}
          <div>
            <h3 className="font-semibold mb-2">
              Behaviors Over Time
            </h3>

            {Object.entries(data.behaviorsPerDay).map(
              ([day, count]) => (
                <div
                  key={day}
                  className="flex justify-between border-b py-1"
                >
                  <span>{day}</span>
                  <span>{count}</span>
                </div>
              )
            )}
          </div>

          {/* PROGRAMS */}
          <div>
            <h3 className="font-semibold mb-2">
              Programs Over Time
            </h3>

            {Object.entries(data.programsPerDay).map(
              ([day, count]) => (
                <div
                  key={day}
                  className="flex justify-between border-b py-1"
                >
                  <span>{day}</span>
                  <span>{count}</span>
                </div>
              )
            )}
          </div>

          {/* AI INSIGHTS */}
          {insightLoading && (
            <p className="text-gray-500">
              Generating AI insight...
            </p>
          )}

          {insights && (
            <div className="border rounded-lg p-4 bg-gray-50 mt-6">
              <h3 className="font-semibold mb-2">
                AI Clinical Insight
              </h3>

              <p className="text-sm text-gray-700 mb-2">
                {insights.summary}
              </p>

              <div className="text-xs flex gap-2">
                <span className="px-2 py-1 border rounded">
                  Status: {insights.status}
                </span>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                {insights.reasoning}
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}