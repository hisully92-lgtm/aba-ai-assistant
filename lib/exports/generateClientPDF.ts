import jsPDF from "jspdf";
import { ClientExport } from "./buildClientExport";

export function generateClientPDF(data: ClientExport) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Clinical Export Packet", 10, 10);

  doc.setFontSize(12);
  doc.text(`Client ID: ${data.clientId}`, 10, 20);
  doc.text(`Generated: ${new Date(data.generatedAt).toLocaleString()}`, 10, 30);

  doc.text(
    `Sessions: ${data.summary.totalSessions}`,
    10,
    50
  );
  doc.text(
    `Behaviors: ${data.summary.totalBehaviors}`,
    10,
    60
  );
  doc.text(
    `Programs: ${data.summary.totalPrograms}`,
    10,
    70
  );

  let y = 90;

  doc.text("Sessions:", 10, y);
  y += 10;

  data.sections.sessions.forEach((s) => {
    doc.text(`- ${s.title}`, 10, y);
    y += 8;
  });

  y += 10;
  doc.text("Behaviors:", 10, y);
  y += 10;

  data.sections.behaviors.forEach((b) => {
    doc.text(`- ${b.title}`, 10, y);
    y += 8;
  });

  y += 10;
  doc.text("Programs:", 10, y);
  y += 10;

  data.sections.programs.forEach((p) => {
    doc.text(`- ${p.title}`, 10, y);
    y += 8;
  });

  doc.save(`clinical-export-${data.clientId}.pdf`);
}