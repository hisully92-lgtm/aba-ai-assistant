import { Redis } from "@upstash/redis";
import { supabaseAdmin } from "@/lib/supabase/server";
import { processJob } from "@/lib/queue/processJob";
import { shouldRetry, getBackoffMs } from "@/lib/worker/retryPolicy";
import { logEvent } from "@/lib/observability/logEvent";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const LOCK_TTL_SECONDS = 60;

async function acquireLock(jobId: string): Promise<boolean> {
  const key = `job_lock:${jobId}`;
  const result = await redis.set(key, "locked", {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  return result === "OK";
}

async function releaseLock(jobId: string): Promise<void> {
  await redis.del(`job_lock:${jobId}`);
}

export async function runJob(jobId: string): Promise<{
  jobId: string;
  success: boolean;
  reason?: string;
}> {
  // Acquire distributed lock — prevents duplicate processing
  const locked = await acquireLock(jobId);
  if (!locked) {
    return { jobId, success: false, reason: "already_processing" };
  }

  try {
    const result = await processJob(jobId);
    return { jobId, success: result.success };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown";

    // Check attempts for retry
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("attempts")
      .eq("id", jobId)
      .single();

    const attempts = job?.attempts ?? 0;

    if (shouldRetry(attempts)) {
      const backoff = getBackoffMs(attempts);

      await supabaseAdmin
        .from("jobs")
        .update({
          status: "pending",
          retry_after: new Date(Date.now() + backoff).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      await logEvent({
        userId: "worker",
        type: "queue",
        event: "job_retry_scheduled",
        metadata: { jobId, attempt: attempts + 1, backoffMs: backoff },
      });

      return { jobId, success: false, reason: `retry_scheduled_attempt_${attempts + 1}` };
    }

    await supabaseAdmin
      .from("jobs")
      .update({
        status: "dead",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    await logEvent({
      userId: "worker",
      type: "error",
      event: "job_dead",
      metadata: { jobId, error: message },
    });

    return { jobId, success: false, reason: "dead" };
  } finally {
    await releaseLock(jobId);
  }
}

export async function runPendingJobs(limit = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}> {
  const { data: jobs, error } = await supabaseAdmin
    .from("jobs")
    .select("id")
    .eq("status", "pending")
    .or(`retry_after.is.null,retry_after.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !jobs?.length) {
    return { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
  }

  const results = await Promise.allSettled(jobs.map((j: any) => runJob(j.id)));

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  results.forEach((r) => {
    if (r.status === "fulfilled") {
      if (r.value.success) succeeded++;
      else if (r.value.reason === "already_processing") skipped++;
      else failed++;
    } else {
      failed++;
    }
  });

  return { processed: jobs.length, succeeded, failed, skipped };
}