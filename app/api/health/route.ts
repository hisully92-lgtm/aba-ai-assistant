import { validateRequiredEnv } from "@/lib/env";

export async function GET() {
  validateRequiredEnv();
  return Response.json({ ok: true });
}