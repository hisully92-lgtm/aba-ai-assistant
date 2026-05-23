import { NextResponse } from "next/server";
import crypto from "crypto";

import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requirePro } from "@/lib/billing/requirePro";
import { logEvent } from "@/lib/observability/logEvent";
import { logAudit } from "@/lib/observability/logAudit";
import { hasFeature } from "@/lib/features";
import { getCache } from "@/lib/cache";
import { createJob } from "@/lib/queue";

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
    if (!hasFeature("pro", "ai_notes")) {
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

    const {
      client_id,
      client_name,
      behaviors_observed,
      interventions_used,
      client_response,
      programs_targeted,
      date,
      staff_member,
    } = body;

    // ⚡ CACHE KEY
    const cacheKey = `ai:session-note:${
      client_id || client_name || "unknown"
    }:${date || "no-date"}`;

    const cached = getCache(cacheKey);

    if (cached) {
      return NextResponse.json({
        result: cached,
        cached: true,
      });
    }

    // 🧠 PROMPT
    const prompt = `
You are an expert ABA clinical documentation assistant.

Write a professional ABA session note.

Use this structure:

1. Objective Summary
2. Target Behaviors
3. Interventions Applied
4. Client Response
5. Skill Acquisition / Programs
6. Clinical Analysis
7. Recommendations for Next Session

Keep tone:
- clinical
- objective
- insurance-ready
- concise but detailed

SESSION DATA:
Client: ${client_name}
Staff: ${staff_member || "Not specified"}
Date: ${date || "Not specified"}

Behaviors Observed:
${behaviors_observed}

Interventions Used:
${interventions_used}

Client Response:
${client_response}

Programs Targeted:
${programs_targeted}
`;

    // 🧠 CREATE JOB (FIXED TYPE)
    const jobId = crypto.randomUUID();

    createJob({
      id: jobId,
      userId: user.id,
      type: "ai_note", // ✅ FIXED (was: session_note)
      payload: {
        client_id,
        prompt,
        cacheKey,
        jobType: "session_note",
      },
      status: "pending",
    });

    // 📊 AUDIT LOG
    await logAudit({
      userId: user.id,
      action: "ai_generated_note",
      resource: client_id,
      metadata: {
        model: "gpt-4o-mini",
        feature: "session_note",
      },
    });

    // 📊 EVENT LOG
    await logEvent({
      userId: user.id,
      type: "ai",
      event: "ai_request_success",
      metadata: {
        route: "session-note",
        mode: "queued",
        jobId,
      },
    });

    // 📊 USAGE TRACKING
    await supabaseAdmin.from("usage_logs").insert({
      user_id: user.id,
      feature: "ai_notes",
    });

    return NextResponse.json({
      jobId,
    });
  } catch (err: any) {
    await logEvent({
      userId: user?.id || "unknown",
      type: "error",
      event: "ai_request_failed",
      metadata: {
        route: "session-note",
        message: err?.message || "Unknown error",
      },
    });

    return NextResponse.json(
      { error: "AI generation failed" },
      { status: 500 }
    );
  }
}