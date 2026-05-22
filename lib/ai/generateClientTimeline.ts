export async function generateClientTimeline(clientId: string) {
  const res = await fetch("/api/ai/client-timeline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ client_id: clientId }),
  });

  if (!res.ok) {
    throw new Error("Timeline generation failed");
  }

  const data = await res.json();
  return data.result;
}