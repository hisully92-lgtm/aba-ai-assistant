import { NextResponse } from "next/server";
import { detectChurnRisks } from "@/lib/analytics/churnRisk";
import { toErrorResponse } from "@/lib/errors";

function isAuthorized(req: Request): boolean {
  const secret = req.headers.get("x-worker-secret");
  return secret === process.env.WORKER_SECRET;
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const risks = await detectChurnRisks();
    return NextResponse.json({ success: true, risks, total: risks.length });

  } catch (err: unknown) {
    const { error, status } = toErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}