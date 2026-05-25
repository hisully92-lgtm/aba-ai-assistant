import { NextResponse } from "next/server";
import { runPendingJobs } from "@/lib/worker/jobRunner";
import { logEvent } from "@/lib/observability/logEvent";
import { logAudit } from "@/lib/observability/logAudit";
import { toErrorResponse } from "@/lib/errors";

async function safe(fn: any, ...args: any[]) {
  try { await fn(...args); } catch {}
}

function isAuthorized(req: Request): boolean {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const workerSecret = req.headers.get("x-worker-secret");
  const isWorkerSecret = workerSecret === process.env.WORKER_SECRET;
  return isVercelCron || isWorkerSecret;
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { processed, succeeded, failed, skipped } = await runPendingJobs(10);

    await safe(logEvent, {
      userId: "worker",
      type: "queue",
      event: "worker_run_complete",
      metadata: { processed, succeeded, failed, skipped },
    });

    await safe(logAudit, {
      userId: "worker",
      action: "queue.worker_run",
      resource: "jobs",
      metadata: { processed, succeeded, failed, skipped },
    });

    return NextResponse.json({ success: true, processed, succeeded, failed, skipped });

  } catch (err: unknown) {
    await safe(logEvent, {
      userId: "worker",
      type: "error",
      event: "worker_run_failed",
      metadata: { error: err instanceof Error ? err.message : "unknown" },
    });

    const { error, status } = toErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}