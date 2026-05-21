import jsPDF from "jspdf";
import { ClinicalReport } from "@/lib/ai/generateClinicalReport";

export function generateClinicalPDF(
  clientName: string,
  reports: ClinicalReport[]
) {
  const doc = new jsPDF();

  let y = 10;

  // TITLE
  doc.setFontSize(16);
  doc.text(`ABA Clinical Report`, 10, y);
  y += 8;

  doc.setFontSize(12);
  doc.text(`Client: ${clientName}`, 10, y);
  y += 10;

  // REPORTS
  reports.forEach((r) => {
    if (y > 270) {
      doc.addPage();
      y = 10;
    }

    doc.setFontSize(11);
    doc.text(r.date, 10, y);
    y += 6;

    const lines = doc.splitTextToSize(r.report, 180);
    doc.text(lines, 10, y);
    y += lines.length * 5 + 6;
  });

  doc.save(`ABA_Clinical_Report_${clientName}.pdf`);
}