export async function exportClientReport(clientId: string) {
  const res = await fetch("/api/ai/export-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ client_id: clientId }),
  });

  if (!res.ok) {
    throw new Error("Export failed");
  }

  const data = await res.json();
  return data.report;
}