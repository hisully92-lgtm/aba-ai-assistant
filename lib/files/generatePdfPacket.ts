import jsPDF from "jspdf";
import { ClientExport } from "@/lib/exports/buildClientExport";

export function generatePdfPacket(data: ClientExport) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Clinical Export Packet", 10, 10);

  doc.setFontSize(12);
  doc.text(`Client ID: ${data.clientId}`, 10, 20);
  doc.text(`Generated: ${data.generatedAt}`, 10, 30);

  doc.text("Summary:", 10, 45);
  doc.text(
    `Sessions: ${data.summary.totalSessions}
Behaviors: ${data.summary.totalBehaviors}
Programs: ${data.summary.totalPrograms}`,
    10,
    55
  );

  doc.save(`clinical-packet-${data.clientId}.pdf`);
}