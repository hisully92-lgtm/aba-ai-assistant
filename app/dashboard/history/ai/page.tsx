"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

type AILog = {
  id: string;
  feature: string;
  duration_ms: number | null;
  success: boolean;
  error: string | null;
  created_at: string;
};

export default function AIRequestHistoryPage() {
  const [logs, setLogs] = useState<AILog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const { data } = await supabase
        .from("ai_usage_logs")
        .select("id, feature, duration_ms, success, error, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      setLogs(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="AI Request History">
        <p className="text-gray-500 text-sm">Your recent AI generation requests.</p>
      </PageHeader>

      <Section title={`${logs.length} requests`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && logs.length === 0 && (
          <p className="text-gray-400 text-sm">No AI requests yet.</p>
        )}
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="border border-gray-100 rounded-xl p-3 bg-white flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-800">{log.feature}</p>
                <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                  <span>{new Date(log.created_at).toLocaleString()}</span>
                  {log.duration_ms && <span>{log.duration_ms}ms</span>}
                  {log.error && <span className="text-red-500">{log.error}</span>}
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                log.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {log.success ? "success" : "failed"}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}