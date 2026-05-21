import { ClientExport } from "@/lib/exports/buildClientExport";

export function generateClinicalPacketPDF(data: ClientExport) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) return;

  const html = `
    <html>
      <head>
        <title>Clinical Packet</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          h1 { font-size: 20px; }
          h2 { margin-top: 20px; font-size: 16px; }
          .box { margin-bottom: 12px; padding: 10px; border: 1px solid #ddd; }
        </style>
      </head>

      <body>
        <h1>Clinical Export Packet</h1>

        <p><strong>Client ID:</strong> ${data.clientId}</p>
        <p><strong>Generated:</strong> ${new Date(data.generatedAt).toLocaleString()}</p>

        <h2>Summary</h2>
        <div class="box">
          Sessions: ${data.summary.totalSessions}<br/>
          Behaviors: ${data.summary.totalBehaviors}<br/>
          Programs: ${data.summary.totalPrograms}
        </div>

        <h2>Sessions</h2>
        ${data.sections.sessions.map((s) => `<div class="box">${s.title}</div>`).join("")}

        <h2>Behaviors</h2>
        ${data.sections.behaviors.map((b) => `<div class="box">${b.title}</div>`).join("")}

        <h2>Programs</h2>
        ${data.sections.programs.map((p) => `<div class="box">${p.title}</div>`).join("")}

      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
}