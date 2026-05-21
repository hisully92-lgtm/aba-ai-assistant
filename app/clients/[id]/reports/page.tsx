"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";

import { getClientTimeline } from "@/lib/timeline/getClientTimeline";
import { buildClinicalSummary } from "@/lib/ai/buildClinicalSummary";
import { generateClinicalReport } from "@/lib/ai/generateClinicalReport";
import { generateClinicalPDF } from "@/lib/pdf/generateClinicalPDF";
import { saveClinicalReport } from "@/lib/reports/saveClinicalReport";
import { generateMonthlyClinicalReport } from "@/lib/reports/generateMonthlyClinicalReport";

export default function ClientReportsPage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [loading, setLoading] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const [reports, setReports] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [monthlyReport, setMonthlyReport] = useState<any | null>(null);

  // =========================
  // DAILY / FULL REPORTS
  // =========================
  async function generateDailyReports() {
    setLoading(true);

    try {
      const timeline = await getClientTimeline(clientId);

      const summaryData = buildClinicalSummary(timeline);
      const reportData = await generateClinicalReport(
        timeline,
        summaryData
      );

      setSummaries(summaryData);
      setReports(reportData);

      await Promise.all(
        reportData.map((r) =>
          saveClinicalReport({
            clientId,
            reportDate: r.date,
            reportText: r.report,
            summaryText:
              summaryData.find((s) => s.date === r.date)?.summaryText ??
              "",
          })
        )
      );
    } catch (err) {
      console.error("Daily report error:", err);
    }

    setLoading(false);
  }

  // =========================
  // MONTHLY REPORT
  // =========================
  async function handleGenerateMonthly() {
    setMonthlyLoading(true);

    try {
      const month = new Date().toISOString().slice(0, 7); // YYYY-MM

      const data = await generateMonthlyClinicalReport(
        clientId,
        month
      );

      setMonthlyReport(data);
    } catch (err) {
      console.error("Monthly report error:", err);
    }

    setMonthlyLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      {/* HEADER */}
      <h2 className="text-2xl font-bold mb-2">Clinical Reports</h2>

      <p className="text-gray-600 mb-6">
        Daily ABA summaries + monthly insurance-ready reports.
      </p>

      {/* ACTIONS */}
      <div className="flex flex-col gap-3 mb-6">
        <Button onClick={generateDailyReports}>
          {loading ? "Generating Daily Reports..." : "Generate Daily Reports"}
        </Button>

        <Button
          onClick={handleGenerateMonthly}
          variant="secondary"
        >
          {monthlyLoading
            ? "Generating Monthly Report..."
            : "Generate Monthly Report"}
        </Button>

        {reports.length > 0 && (
          <Button
            onClick={() => generateClinicalPDF(clientId, reports)}
            variant="outline"
          >
            Download PDF Report
          </Button>
        )}
      </div>

      {/* DAILY REPORT OUTPUT */}
      {!loading && reports.length > 0 && (
        <div className="space-y-6">
          {reports.map((r, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 bg-gray-50"
            >
              <h3 className="font-semibold mb-2">{r.date}</h3>

              <p className="text-gray-700 whitespace-pre-line">
                {r.report}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* MONTHLY REPORT OUTPUT */}
      {monthlyReport && (
        <div className="border rounded-lg p-4 bg-blue-50 mt-8">
          <h3 className="font-semibold mb-2">
            Monthly Clinical Summary
          </h3>

          <p className="text-sm whitespace-pre-line">
            {monthlyReport.summary}
          </p>
        </div>
      )}

      {/* DEBUG SUMMARIES (optional) */}
      {summaries.length > 0 && (
        <div className="mt-10 border-t pt-6">
          <h3 className="font-bold mb-2">Daily Summaries</h3>

          {summaries.map((s, i) => (
            <div key={i} className="text-sm text-gray-600 mb-2">
              {s.date}: {s.summaryText}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}