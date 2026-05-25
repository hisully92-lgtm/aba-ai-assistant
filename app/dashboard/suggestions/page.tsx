"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Suggestion = {
  clientId: string;
  clientName: string;
  riskLevel: string;
  riskScore: number | null;
  suggestions: string[];
};

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: riskData } = await supabase
      .from("client_risk")
      .select("client_id, risk_level, risk_score, forecast_score")
      .order("risk_score", { ascending: false })
      .limit(20);

    if (!riskData?.length) { setLoading(false); return; }

    const clientIds = riskData.map((r: any) => r.client_id);
    const { data: clients } = await supabase
      .from("clients")
      .select("id, full_name")
      .in("id", clientIds);

    const clientMap = new Map((clients ?? []).map((c: any) => [c.id, c.full_name]));

    const result: Suggestion[] = riskData.map((r: any) => {
      const suggestions: string[] = [];

      if (r.risk_level === "high") {
        suggestions.push("Schedule immediate supervisor review");
        suggestions.push("Increase session frequency");
        suggestions.push("Review and update behavior intervention plan");
      } else if (r.risk_level === "medium") {
        suggestions.push("Monitor closely over next 7 days");
        suggestions.push("Review recent session notes for patterns");
        suggestions.push("Consider adjusting intervention strategies");
      } else {
        suggestions.push("Continue current intervention plan");
        suggestions.push("Maintain regular session schedule");
      }

      if (r.forecast_score > 80) {
        suggestions.push("High escalation probability — proactive intervention recommended");
      }

      return {
        clientId: r.client_id,
        clientName: clientMap.get(r.client_id) ?? "Unknown",
        riskLevel: r.risk_level,
        riskScore: r.risk_score,
        suggestions,
      };
    });

    setSuggestions(result);
    setLoading(false);
  }

  function riskColor(level: string) {
    if (level === "high") return "bg-red-100 text-red-700 border-red-200";
    if (level === "medium") return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-green-100 text-green-700 border-green-200";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clinical Suggestions">
        <p className="text-gray-500 text-sm">AI-driven clinical recommendations based on risk data.</p>
      </PageHeader>

      {loading && <p className="text-gray-400 text-sm p-6">Loading suggestions...</p>}

      {!loading && suggestions.length === 0 && (
        <Section title="Suggestions">
          <p className="text-gray-400 text-sm">No risk data available yet. Visit the clinician dashboard to compute scores.</p>
        </Section>
      )}

      <div className="space-y-4">
        {suggestions.map((s) => (
          <Section key={s.clientId} title={s.clientName}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-medium px-2 py-1 rounded-full border ${riskColor(s.riskLevel)}`}>
                {s.riskLevel} risk
              </span>
              {s.riskScore != null && (
                <span className="text-xs text-gray-500">Score: {s.riskScore}%</span>
              )}
            </div>
            <ul className="space-y-2">
              {s.suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-500 mt-0.5">→</span>
                  {suggestion}
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Button
                variant="outline"
                onClick={() => window.location.href = `/dashboard/clients/${s.clientId}/case`}
              >
                View Case
              </Button>
            </div>
          </Section>
        ))}
      </div>
    </div>
  );
}