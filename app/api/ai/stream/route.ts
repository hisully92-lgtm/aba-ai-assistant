import { supabaseAdmin } from "@/lib/supabase/server";
import { requirePro } from "@/lib/billing/requirePro";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeObject, sanitizePrompt } from "@/lib/sanitize";
import { logAccess } from "@/lib/observability/logAccess";
import { logEvent } from "@/lib/observability/logEvent";
import { toErrorResponse } from "@/lib/errors";
import { decryptSessionFields } from "@/lib/security/encryptSession";
import { buildClientSummaryPrompt } from "@/lib/ai/prompts";
import { getModelConfig, logModelSelection, type AITaskType } from "@/lib/ai/modelRouter";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function extractIp(req: Request): string {
  return (
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown"
  );
}

export async function POST(req: Request) {
  const ip = extractIp(req);

  try {
    // AUTH
    const { data: auth } = await supabaseAdmin.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // BILLING
    await requirePro(user.id);

    // RATE LIMIT
    const allowed = await rateLimit(`stream:${user.id}`, 20, 60_000);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 });
    }

    // PARSE + SANITIZE
    const raw = await req.json();
    const sanitized = sanitizeObject(raw);
    const { type, client_id } = sanitized as { type: string; client_id: string };

    if (!type || !client_id) {
      return new Response(JSON.stringify({ error: "Missing type or client_id" }), { status: 400 });
    }

    // RESOLVE MODEL
    const modelConfig = getModelConfig(type as AITaskType);
    logModelSelection(type as AITaskType);

    // FETCH SESSION DATA
    const { data: sessions, error } = await (supabaseAdmin
  .from("sessions") as any)
  .select("date, behaviors_observed, interventions_used, client_response, programs_targeted")
  .eq("client_id", client_id)
  .order("created_at", { ascending: false })
  .limit(20);

    if (error) throw new Error(error.message);

    await logAccess({
      userId: user.id,
      resource: "sessions",
      action: "read",
      recordId: client_id,
      ip,
      metadata: { jobType: `stream_${type}`, model: modelConfig.model },
    });

    const historyText =
      sessions?.map((s: any) => {
          const decrypted = decryptSessionFields(s);
          return `
Date: ${s.date}
Behaviors: ${decrypted.behaviors_observed}
Interventions: ${decrypted.interventions_used}
Response: ${decrypted.client_response}
Programs: ${decrypted.programs_targeted}
---`;
        })
        .join("\n") || "No session data available.";

    const prompt = sanitizePrompt(buildClientSummaryPrompt(historyText));

    // SSE STREAM
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = anthropic.messages.stream({
            model: modelConfig.model,
            max_tokens: modelConfig.maxTokens,
            messages: [{ role: "user", content: prompt }],
          });

          for await (const chunk of anthropicStream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              const data = `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

          await logEvent({
            userId: user.id,
            type: "ai",
            event: "stream_complete",
            metadata: { type, client_id, ip, model: modelConfig.model },
          });

        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (err: unknown) {
    const { error, status } = toErrorResponse(err);
    return new Response(JSON.stringify({ error }), { status });
  }
}