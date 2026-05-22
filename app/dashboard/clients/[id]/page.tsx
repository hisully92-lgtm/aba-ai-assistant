"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabase/client";

import ClientOverview from "@/components/clients/ClientOverview";
import Button from "@/components/ui/Button";

import { generateClientSummary } from "@/lib/ai/generateClientSummary";
import { exportClientReport } from "@/lib/ai/exportClientReport";
import { generateClientTimeline } from "@/lib/ai/generateClientTimeline";

import ClientProgressSection from "@/components/analytics/ClientProgressSection";

type Client = {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
};

export default function ClientDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  // 🧠 AI STATES
  const [aiLoading, setAiLoading] = useState(false);
  const [summary, setSummary] = useState("");

  const [exportLoading, setExportLoading] = useState(false);
  const [report, setReport] = useState("");

  useEffect(() => {
    if (!id) return;

    async function fetchClient() {
      setLoading(true);

      const { data, error } = await supabase
        .from("clients")
        .select("id, name, age, diagnosis")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        setClient(null);
      } else {
        setClient(data as Client);
      }

      setLoading(false);
    }

    fetchClient();
  }, [id]);

  // 🧠 AI SUMMARY
  async function handleGenerateSummary() {
    if (!id) return;

    try {
      setAiLoading(true);
      const result = await generateClientSummary(id);
      setSummary(result);
    } catch (err) {
      console.error(err);
      alert("Failed to generate AI summary");
    } finally {
      setAiLoading(false);
    }
  }

  // 🟣 EXPORT REPORT
  async function handleExportReport() {
    if (!id) return;

    try {
      setExportLoading(true);
      const result = await exportClientReport(id);
      setReport(result);
    } catch (err) {
      console.error(err);
      alert("Failed to export report");
    } finally {
      setExportLoading(false);
    }
  }

  if (loading) return <p>Loading client...</p>;
  if (!client) return <p>Client not found</p>;

  return (
    <div style={{ padding: 20 }}>
      {/* CLIENT OVERVIEW */}
      <ClientOverview client={client} />

      {/* 🧠 AI SUMMARY */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ marginBottom: 12 }}>
          AI Clinical Insights
        </h2>

        <Button onClick={handleGenerateSummary} loading={aiLoading}>
          Generate Client Progress Summary
        </Button>

        {summary && (
          <div style={{ marginTop: 16 }}>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                padding: 16,
                border: "1px solid #ddd",
                borderRadius: 8,
                background: "#fafafa",
              }}
            >
              {summary}
            </pre>
          </div>
        )}
      </section>

      {/* 🟣 EXPORT */}
      <section style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 12 }}>
          Clinical Export Report
        </h2>

        <Button
          onClick={handleExportReport}
          loading={exportLoading}
          variant="secondary"
        >
          Export Clinical Report
        </Button>

        {report && (
          <div style={{ marginTop: 16 }}>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                padding: 16,
                border: "1px solid #ddd",
                borderRadius: 8,
                background: "#f9f9f9",
              }}
            >
              {report}
            </pre>
          </div>
        )}
      </section>

      {/* 📊 TIMELINE + GRAPH SYSTEM */}
      <section style={{ marginTop: 32 }}>
        <h2 style={{ marginBottom: 12 }}>
          Client Timeline Insights
        </h2>

        <Button
          onClick={() => generateClientTimeline(id!)}
          variant="primary"
        >
          Generate Timeline Analysis
        </Button>

        {/* REAL GRAPH COMPONENT */}
        <ClientProgressSection />
      </section>
    </div>
  );
}