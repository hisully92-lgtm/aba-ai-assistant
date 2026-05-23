import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requirePro } from "@/lib/billing/requirePro";
import { logEvent } from "@/lib/observability/logEvent";
import { logAudit } from "@/lib/observability/logAudit";
import { hasFeature } from "@/lib/features";
import { getCache } from "@/lib/cache";
import { createJob } from "@/lib/queue/createJob";

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
    if (!hasFeature("pro", "client_timeline")) {
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
    const cacheKey = `ai:client-timeline:${client_id}`;
    const cached = getCache(cacheKey);

    if (cached) {
      return NextResponse.json({ result: cached, cached: true });
    }

    // 📦 FETCH DATA
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select(
        "date, behaviors_observed, interventions_used, client_response, programs_targeted"
      )
      .eq("client_id", client_id)
      .order("date", { ascending: true })
      .limit(50);

    if (error) throw new Error(error.message);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        result: "No session data available for timeline analysis.",
      });
    }

    const timelineData = sessions
      .map(
        (s, i) => `
Session ${i + 1}
Date: ${s.date}
Behaviors: ${s.behaviors_observed}
Interventions: ${s.interventions_used}
Response: ${s.client_response}
Programs: ${s.programs_targeted}
---`
      )
      .join("\n");

    // 🧠 PROMPT (FIXED — WAS MISSING)
    const prompt = `
You are an expert ABA clinical analyst.

Analyze this client's chronological session timeline and produce:

1. Behavioral progression over time
2. Intervention effectiveness trends
3. Skill acquisition trajectory
4. Regression or risk periods
5. Notable improvements
6. Clinical timeline summary
7. Recommendations

Be structured, objective, and clinically concise.

TIMELINE DATA:
${timelineData}
`;

    // 🧠 CREATE JOB
    const jobId = crypto.randomUUID();

    createJob({
      id: jobId,
      userId: user.id,
      type: "client_timeline",
      payload: {
        client_id,
        prompt,
        cacheKey,
        sessions,
      },
      status: "pending",
    });

    // 📊 AUDIT LOG (NEW MERGED REQUIREMENT)
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
        route: "client-timeline",
        mode: "queued",
        jobId,
      },
    });

    // 📊 USAGE TRACKING
    await supabaseAdmin.from("usage_logs").insert({
      user_id: user.id,
      feature: "client_timeline",
    });

    return NextResponse.json({ jobId });
  } catch (err: any) {
    await logEvent({
      userId: user?.id || "unknown",
      type: "error",
      event: "ai_request_failed",
      metadata: {
        route: "client-timeline",
        message: err?.message || "Unknown error",
      },
    });

    return NextResponse.json(
      { error: "Timeline analysis failed" },
      { status: 500 }
    );
  }
}