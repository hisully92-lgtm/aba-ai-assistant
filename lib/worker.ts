import { getJob, updateJob } from "./queue";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function processJob(jobId: string) {
  const job = getJob(jobId);
  if (!job) return;

  updateJob(jobId, { status: "processing" });

  try {
    let result;

    if (job.type === "ai_summary") {
      result = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: JSON.stringify(job.payload),
          },
        ],
      });
    }

    updateJob(jobId, {
      status: "done",
      payload: result,
    });
  } catch (err) {
    updateJob(jobId, {
      status: "failed",
    });
  }
}