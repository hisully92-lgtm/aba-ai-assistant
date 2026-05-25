import { jsPDF } from "jspdf";

type RiskLevel = "low" | "medium" | "high" | "unknown";

export type AnalyticsReportData = {
  clientName: string;
  reportDate: string;
  riskLevel: RiskLevel;
  riskScore: number | null;
  forecastScore: number | null;
  totalExports: number;
  approvedExports: number;
  rejectedExports: number;
  pendingExports: number;
  recentSessions: {
    date: string;
    status: string;
    notes?: string;
  }[];
};

export function generateAnalyticsPDF(data: AnalyticsReportData): Blob {
  const doc = new jsPDF();

  const approvalRate = data.totalExports
    ? Math.round((data.approvedExports / data.totalExports) * 100)
    : 0;

  // HEADER
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Clinical Analytics Report", 20, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 28);
  doc.text(`Report Date: ${data.reportDate}`, 20, 34);

  // DIVIDER
  doc.setDrawColor(220);
  doc.line(20, 38, 190, 38);

  // CLIENT INFO
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Client", 20, 48);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(data.clientName, 20, 56);

  // RISK SECTION
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Risk Intelligence", 20, 72);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Risk Level: ${data.riskLevel.toUpperCase()}`, 20, 80);
  doc.text(`Risk Score: ${data.riskScore != null ? `${data.riskScore}%` : "N/A"}`, 20, 88);
  doc.text(`Forecast Score: ${data.forecastScore != null ? `${data.forecastScore}%` : "N/A"}`, 20, 96);

  // EXPORT STATS
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Export Summary", 20, 112);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Exports: ${data.totalExports}`, 20, 120);
  doc.text(`Approved: ${data.approvedExports}`, 20, 128);
  doc.text(`Rejected: ${data.rejectedExports}`, 20, 136);
  doc.text(`Pending: ${data.pendingExports}`, 20, 144);
  doc.text(`Approval Rate: ${approvalRate}%`, 20, 152);

  // RECENT SESSIONS
  if (data.recentSessions.length > 0) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Recent Sessions", 20, 168);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    let y = 176;
    data.recentSessions.slice(0, 5).forEach((s) => {
      doc.text(
        `${new Date(s.date).toLocaleDateString()} — ${s.status}${s.notes ? `: ${s.notes.slice(0, 60)}` : ""}`,
        20,
        y
      );
      y += 8;
    });
  }

  // FOOTER
  doc.setFontSize(9);
  doc.setTextColor(160);
  doc.text("Confidential — For clinical use only", 20, 285);

  return doc.output("blob");
}