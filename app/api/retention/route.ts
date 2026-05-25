import { NextResponse } from "next/server";
import { runRetentionCleanup } from "@/lib/retention/cleanupLogs";
import { toErrorResponse } from "@/lib/errors";

function isAuthorized(req: Request): boolean {
  const secret = req.headers.get("x-worker-secret");
  return secret === process.env.WORKER_SECRET;
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runRetentionCleanup();
    return NextResponse.json({ success: true, ...result });

  } catch (err: unknown) {
    const { error, status } = toErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}