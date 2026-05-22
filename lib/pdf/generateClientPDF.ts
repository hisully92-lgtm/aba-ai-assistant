import { ClientExport } from "@/lib/exports/buildClientExport";

export async function generateClientPDF(data: ClientExport) {
  const html = `
    <html>
      <head>
        <title>Clinical Export</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          h1 { font-size: 20px; }
          h2 { margin-top: 20px; }
          .box { padding: 10px; border: 1px solid #ddd; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <h1>Clinical Export Packet</h1>

        <p><b>Client:</b> ${data.clientId}</p>
        <p><b>Date:</b> ${new Date(data.generatedAt).toLocaleString()}</p>

        <h2>Summary</h2>
        <div class="box">
          Sessions: ${data.summary.totalSessions}<br/>
          Behaviors: ${data.summary.totalBehaviors}<br/>
          Programs: ${data.summary.totalPrograms}
        </div>

        <h2>Sessions</h2>
        ${data.sections.sessions.map(s => `<div class="box">${s.title}</div>`).join("")}

        <h2>Behaviors</h2>
        ${data.sections.behaviors.map(b => `<div class="box">${b.title}</div>`).join("")}

        <h2>Programs</h2>
        ${data.sections.programs.map(p => `<div class="box">${p.title}</div>`).join("")}
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: "text/html" });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `clinical-export-${data.clientId}.html`;
  a.click();

  URL.revokeObjectURL(url);
}