"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { telemetry } from "@/lib/telemetry";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";

export default function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [client, setClient] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      setClient(data);
      setLoading(false);
    }
    init();
  }, [clientId]);

  async function handleGenerateSummary() {
    if (!userId) return;
    setGenerating(true);
    setError(null);
    setSummary(null);

    try {
      const res = await telemetry.ai.summary(
        { type: "summary", client_id: clientId },
        userId
      );

      if (res.error) {
        setError(res.error);
        return;
      }

      setSummary("AI summary queued successfully. Check back shortly for results.");
    } catch (err: any) {
      setError(err?.message || "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function navigate(path: string) {
    window.location.href = path;
  }

  if (loading) return <div className="p-6">Loading client...</div>;

  if (!client) return <div className="p-6 text-red-500">Client not found.</div>;

  return (
    <div className="space-y-6">
      <Section title={client.name}>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          {client.age && <p>Age: {client.age}</p>}
          {client.diagnosis && <p>Diagnosis: {client.diagnosis}</p>}
          {client.caregiver_name && <p>Caregiver: {client.caregiver_name}</p>}
        </div>
      </Section>

      <Section title="AI Clinical Summary">
        {error && (
          <p className="text-red-500 text-sm mb-3">{error}</p>
        )}

        {summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-3">
            {summary}
          </div>
        )}

        <Button
          onClick={handleGenerateSummary}
          loading={generating}
          variant="secondary"
        >
          Generate AI Summary
        </Button>
      </Section>

      <Section title="Client Records">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboard/clients/${clientId}/timeline`)}
          >
            View Timeline
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboard/clients/${clientId}/report`)}
          >
            Export Report
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboard/sessions?client_id=${clientId}`)}
          >
            View Sessions
          </Button>
        </div>
      </Section>
    </div>
  );
}