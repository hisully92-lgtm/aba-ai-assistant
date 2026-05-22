export async function generateClientSummary(clientId: string) {
  const res = await fetch("/api/ai/client-summary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ client_id: clientId }),
  });

  if (!res.ok) {
    throw new Error("Failed to generate client summary");
  }

  const data = await res.json();
  return data.result;
}