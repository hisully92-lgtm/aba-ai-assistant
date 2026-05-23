import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requirePro } from "@/lib/billing/requirePro";
import { logEvent } from "@/lib/observability/logEvent";
import { hasFeature } from "@/lib/features";
import { getCache, setCache } from "@/lib/cache";
import { createJob } from "@/lib/queue";
import { logAudit } from "@/lib/observability/logAudit";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  let user: any = null;

  try {
    // 🔐 AUTH
    const { data: auth } = await supabaseAdmin.auth.getUser();
    user = auth?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 💳 PRO CHECK
    await requirePro(user.id);

    // 🚀 FEATURE GATE
    if (!hasFeature("pro", "ai_summary")) {
      return NextResponse.json(
        { error: "Feature not available" },
        { status: 403 }
      );
    }

    // 🚦 RATE LIMIT
    if (!rateLimit(`ai:${user.id}`, 20, 60_000)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { client_id } = body;

    if (!client_id) {
      return NextResponse.json(
        { error: "Missing client_id" },
        { status: 400 }
      );
    }

    // ⚡ CACHE CHECK
    const cacheKey = `ai:client-summary:${client_id}`;
    const cached = getCache(cacheKey);

    if (cached) {
      return NextResponse.json({ result: cached, cached: true });
    }

    // 📦 FETCH DATA
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);

    const historyText =
      sessions
        ?.map(
          (s) => `
Date: ${s.date}
Behaviors: ${s.behaviors_observed}
Interventions: ${s.interventions_used}
Response: ${s.client_response}
Programs: ${s.programs_targeted}
---`
        )
        .join("\n") || "";

    const prompt = `
You are an expert ABA clinical analyst.

Analyze the client's full session history and produce:

1. Behavioral Trends
2. Skill Acquisition Progress
3. Response to Interventions
4. Areas of Concern
5. Strengths
6. Clinical Summary
7. Recommendations for Treatment Plan Adjustment

Be objective, clinical, and concise.

CLIENT SESSION HISTORY:
${historyText}
`;

    // 🧠 CREATE JOB
    const jobId = crypto.randomUUID();

    createJob({
      id: jobId,
      userId: user.id,
      type: "ai_summary",
      payload: {
        client_id,
        prompt,
        cacheKey,
        sessions,
      },
      status: "pending",
    });

    // 📊 AUDIT LOG (NEW — MERGED)
    await logAudit({
      userId: user.id,
      action: "ai_generated_note",
      resource: client_id,
      metadata: {
        model: "gpt-4o-mini",
      },
    });

    // 📊 EVENT LOG
    await logEvent({
      userId: user.id,
      type: "ai",
      event: "ai_request_success",
      metadata: {
        route: "client-summary",
        mode: "queued",
      },
    });

    // 📊 USAGE TRACKING
    await supabaseAdmin.from("usage_logs").insert({
      user_id: user.id,
      feature: "ai_summary",
    });

    return NextResponse.json({ jobId });
  } catch (err: any) {
    await logEvent({
      userId: user?.id || "unknown",
      type: "error",
      event: "ai_request_failed",
      metadata: {
        route: "client-summary",
        message: err?.message || "Unknown error",
      },
    });

    return NextResponse.json(
      { error: "Client summary failed" },
      { status: 500 }
    );
  }
}