import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requirePro } from "@/lib/billing/requirePro";
import { logEvent } from "@/lib/observability/logEvent";
import { logAudit } from "@/lib/observability/logAudit";
import { hasFeature } from "@/lib/features";
import { getCache } from "@/lib/cache";
import { createJob } from "@/lib/queue";

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
    if (!hasFeature("pro", "export_reports")) {
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
    const cacheKey = `ai:export-report:${client_id}`;
    const cached = getCache(cacheKey);

    if (cached) {
      return NextResponse.json({
        report: cached,
        cached: true,
      });
    }

    // 📦 FETCH DATA
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        report: "No session data available for report generation.",
      });
    }

    const history =
      sessions
        .map(
          (s) => `
Date: ${s.date}
Behaviors: ${s.behaviors_observed}
Interventions: ${s.interventions_used}
Response: ${s.client_response}
Programs: ${s.programs_targeted}
---`
        )
        .join("\n") || "";

    // 🧠 PROMPT
    const prompt = `
You are an expert ABA clinical report generator.

Generate a structured export report including:

1. Clinical Summary
2. Behavioral Trends
3. Intervention Effectiveness
4. Progress Overview
5. Risk Areas
6. Recommendations
7. Formal Export Formatting (report-ready)

Be concise, structured, and professional.

SESSION DATA:
${history}
`;

    // 🧠 CREATE JOB (FIXED TYPE)
    const jobId = crypto.randomUUID();

    createJob({
      id: jobId,
      userId: user.id,
      type: "ai_report", // ✅ FIXED (was: "export_report")
      payload: {
        client_id,
        prompt,
        cacheKey,
        sessions,
        jobType: "export_report", // optional metadata for tracking
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
        feature: "export_report",
      },
    });

    // 📊 EVENT LOG
    await logEvent({
      userId: user.id,
      type: "ai",
      event: "ai_request_success",
      metadata: {
        route: "export-report",
        mode: "queued",
        jobId,
      },
    });

    // 📊 USAGE TRACKING
    await supabaseAdmin.from("usage_logs").insert({
      user_id: user.id,
      feature: "export_reports",
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
        route: "export-report",
        message: err?.message || "Unknown error",
      },
    });

    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}