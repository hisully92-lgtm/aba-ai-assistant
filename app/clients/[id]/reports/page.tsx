"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { telemetry } from "@/lib/telemetry";
import Button from "@/components/ui/Button";
import { generateMonthlyClinicalReport } from "@/lib/reports/generateMonthlyClinicalReport";
import { saveClinicalReport } from "@/lib/reports/saveClinicalReport";

export default function ClientReportsPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [loading, setLoading] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [monthlyReport, setMonthlyReport] = useState<any | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI REPORT via unified engine
  async function handleGenerateReport() {
    setLoading(true);
    setError(null);
    setAiResult(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const res = await telemetry.ai.report(
        { type: "report", client_id: clientId },
        user.id
      );

      if (res.error) {
        setError(res.error);
        return;
      }

      setAiResult("AI clinical report queued. Check back shortly for results.");

      await saveClinicalReport({
        clientId,
        reportDate: new Date().toISOString().split("T")[0],
        reportText: "AI report queued via telemetry pipeline.",
        summaryText: "Queued",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setLoading(false);
    }
  }

  // MONTHLY REPORT
  async function handleGenerateMonthly() {
    setMonthlyLoading(true);
    setError(null);

    try {
      const month = new Date().toISOString().slice(0, 7);
      const data = await generateMonthlyClinicalReport(clientId, month);
      setMonthlyReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Monthly report failed");
    } finally {
      setMonthlyLoading(false);
    }
  }

  // PDF DOWNLOAD via /api/reports
  async function handleDownloadPDF() {
    setPdfLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "PDF generation failed");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${clientId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "PDF download failed");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">Clinical Reports</h2>
      <p className="text-gray-600 mb-6">
        AI-generated clinical reports and monthly summaries.
      </p>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="flex flex-col gap-3 mb-6">
        <Button onClick={handleGenerateReport} loading={loading}>
          Generate AI Clinical Report
        </Button>

        <Button onClick={handleGenerateMonthly} loading={monthlyLoading} variant="secondary">
          Generate Monthly Report
        </Button>

        <Button onClick={handleDownloadPDF} loading={pdfLoading} variant="outline">
          Download PDF Report
        </Button>
      </div>

      {aiResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-4">
          {aiResult}
        </div>
      )}

      {monthlyReport && (
        <div className="border rounded-lg p-4 bg-blue-50 mt-4">
          <h3 className="font-semibold mb-2">Monthly Clinical Summary</h3>
          <p className="text-sm whitespace-pre-line">{monthlyReport.summary}</p>
        </div>
      )}
    </div>
  );
}