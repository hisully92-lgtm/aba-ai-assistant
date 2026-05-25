import { aiClient } from "@/lib/ai/aiClient";

export async function exportClientReport(clientId: string) {
  const res = await aiClient.report({ client_id: clientId });

  if (res.error) {
    throw new Error(res.error);
  }

  return res.result;
}