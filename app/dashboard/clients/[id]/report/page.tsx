"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { telemetry } from "@/lib/telemetry";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";

export default function ClientReportPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [client, setClient] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("id", clientId)
        .single();

      setClient(data);
    }
    init();
  }, [clientId]);

  async function handleGenerateReport() {
    if (!userId) return;
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await telemetry.ai.report(
        { type: "report", client_id: clientId },
        userId
      );

      if (res.error) {
        setError(res.error);
        return;
      }

      setResult("Export report queued successfully. Check back shortly for results.");
    } catch (err: any) {
      setError(err?.message || "Report generation failed");
    } finally {
      setGenerating(false);
    }
  }

 return (
    <div className="space-y-6">
      <Section title="Export Report">
        <p className="text-gray-500 text-sm mb-4">
          Generate a structured clinical export report for this client based on their session history.
        </p>

        {error && (
          <p className="text-red-500 text-sm mb-3">{error}</p>
        )}

        {result && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-3">
            {result}
          </div>
        )}

        <Button
          onClick={handleGenerateReport}
          loading={generating}
          variant="secondary"
        >
          Generate Export Report
        </Button>
      </Section>
    </div>
  );
}