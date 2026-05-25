import { supabaseAdmin } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { getModelConfig, logModelSelection, type AITaskType } from "@/lib/ai/modelRouter";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MAX_ATTEMPTS = 3;

export async function processJob(jobId: string) {
  // FETCH JOB
  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // CHECK MAX ATTEMPTS
  if (job.attempts >= MAX_ATTEMPTS) {
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "dead",
        error: `Max attempts (${MAX_ATTEMPTS}) reached`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return { success: false, jobId, reason: "max_attempts_reached" };
  }

  // MARK AS PROCESSING
  await supabaseAdmin
    .from("jobs")
    .update({
      status: "processing",
      attempts: job.attempts + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  // RESOLVE MODEL FROM JOB TYPE
  const jobType = (job.payload?.jobType ?? "summary") as AITaskType;
  const modelConfig = getModelConfig(jobType);
  logModelSelection(jobType);

  try {
    // RUN AI WITH ROUTED MODEL
    const response = await anthropic.messages.create({
      model: modelConfig.model,
      max_tokens: modelConfig.maxTokens,
      messages: [
        {
          role: "user",
          content: job.payload.prompt,
        },
      ],
    });

    const result = response.content
      .map((block: any) => (block.type === "text" ? block.text : ""))
      .join("\n");

    // MARK AS COMPLETE
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "complete",
        result: { text: result, model: modelConfig.model },
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return { success: true, jobId, result, model: modelConfig.model };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const attempts = job.attempts + 1;
    const willRetry = attempts < MAX_ATTEMPTS;

    await supabaseAdmin
      .from("jobs")
      .update({
        status: willRetry ? "pending" : "dead",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    throw err;
  }
}