import { jsPDF } from "jspdf";

type ExportWithRisk = {
  risk: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected";
  forecastScore: number;
  client_id: string;
};

export function generateAnalyticsPDF(data: ExportWithRisk[]) {
  const doc = new jsPDF();

  const total = data.length;
  const approved = data.filter((d) => d.status === "approved").length;
  const rejected = data.filter((d) => d.status === "rejected").length;

  const highRisk = data.filter((d) => d.risk === "high").length;

  const approvalRate = total ? Math.round((approved / total) * 100) : 0;

  const avgForecast = total
    ? Math.round(data.reduce((sum, d) => sum + d.forecastScore, 0) / total)
    : 0;

  // HEADER
  doc.setFontSize(16);
  doc.text("Clinic Analytics Report", 20, 20);

  doc.setFontSize(11);
  doc.text(`Total Exports: ${total}`, 20, 40);
  doc.text(`Approved: ${approved}`, 20, 50);
  doc.text(`Rejected: ${rejected}`, 20, 60);
  doc.text(`High Risk Cases: ${highRisk}`, 20, 70);

  doc.text(`Approval Rate: ${approvalRate}%`, 20, 80);
  doc.text(`Avg Forecast Score: ${avgForecast}`, 20, 90);

  // RISK SUMMARY
  doc.text("Risk Breakdown:", 20, 110);
  doc.text(`Low: ${data.filter(d => d.risk === "low").length}`, 20, 120);
  doc.text(`Medium: ${data.filter(d => d.risk === "medium").length}`, 20, 130);
  doc.text(`High: ${highRisk}`, 20, 140);

  doc.save("clinic-analytics-report.pdf");
}