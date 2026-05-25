import { NextResponse } from "next/server";
import crypto from "crypto";

import { supabaseAdmin } from "@/lib/supabase/server";
import { requirePro } from "@/lib/billing/requirePro";
import { rateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/observability/logEvent";
import { logAudit } from "@/lib/observability/logAudit";
import { logAccess } from "@/lib/observability/logAccess";
import { encryptSessionFields, decryptSessionFields } from "@/lib/security/encryptSession";
import { invalidateClientCache } from "@/lib/cache/invalidate";

// =========================
// SAFE LOGGING
// =========================
async function safe(fn: any, ...args: any[]) {
  try {
    await fn(...args);
  } catch {}
}

// =========================
// EXTRACT IP
// =========================
function extractIp(req: Request): string {
  return (
    (req.headers.get("x-forwarded-for") ?? "")
      .split(",")[0]
      .trim() || "unknown"
  );
}

// =========================
// GET — READ SESSION(S)
// =========================
export async function GET(req: Request) {
  let user: any = null;

  try {
    const ip = extractIp(req);
    const ipAllowed = await rateLimit(`ip:${ip}`, 100, 60_000);
    if (!ipAllowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { data: auth } = await supabaseAdmin.auth.getUser();
    user = auth?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePro(user.id);

    const userAllowed = await rateLimit(`sessions:read:${user.id}`, 60, 60_000);
    if (!userAllowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const client_id = searchParams.get("client_id");
    const session_id = searchParams.get("session_id");

    let query = supabaseAdmin
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (session_id) {
      query = query.eq("id", session_id);
    } else if (client_id) {
      query = query.eq("client_id", client_id);
    }

    const { data: sessions, error } = await query;

    if (error) throw new Error(error.message);

    // DECRYPT PHI FIELDS
    const decrypted = sessions?.map((s) => ({
      ...s,
      ...decryptSessionFields(s),
    }));

    await safe(logAccess, {
      userId: user.id,
      resource: "sessions",
      action: "read",
      recordId: client_id || session_id || "all",
      metadata: { ip },
    });

    return NextResponse.json({ success: true, data: decrypted });

  } catch (err: any) {
    await safe(logEvent, {
      userId: user?.id || "unknown",
      type: "error",
      event: "sessions.read.failed",
      metadata: { error: err?.message },
    });

    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

// =========================
// POST — CREATE SESSION
// =========================
export async function POST(req: Request) {
  let user: any = null;

  try {
    const ip = extractIp(req);
    const ipAllowed = await rateLimit(`ip:${ip}`, 100, 60_000);
    if (!ipAllowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { data: auth } = await supabaseAdmin.auth.getUser();
    user = auth?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePro(user.id);

    const userAllowed = await rateLimit(`sessions:create:${user.id}`, 30, 60_000);
    if (!userAllowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();

    const {
      client_id,
      company_id,
      location_id,
      start_time,
      end_time,
      status,
      color,
      is_recurring,
      recurrence_rule,
      date,
      behaviors_observed,
      interventions_used,
      client_response,
      programs_targeted,
      staff_member,
      notes,
    } = body;

    if (!start_time) {
      return NextResponse.json({ error: "start_time is required" }, { status: 400 });
    }

    if (!client_id) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }

    // ENCRYPT PHI FIELDS
    const encrypted = encryptSessionFields({
      behaviors_observed,
      interventions_used,
      client_response,
      programs_targeted,
      staff_member,
      notes,
    });

    const id = crypto.randomUUID();

    const { error } = await supabaseAdmin.from("sessions").insert({
      id,
      client_id,
      company_id: company_id || null,
      location_id: location_id || null,
      created_by: user.id,
      start_time,
      end_time: end_time || null,
      status: status || "scheduled",
      color: color || null,
      is_recurring: is_recurring || false,
      recurrence_rule: recurrence_rule || null,
      date: date || null,
      ...encrypted,
    });

    if (error) throw new Error(error.message);

    // INVALIDATE CACHE
    await invalidateClientCache(client_id);

    await safe(logAccess, {
      userId: user.id,
      resource: "sessions",
      action: "write",
      recordId: client_id,
      metadata: { session_id: id, containsPHI: true },
    });

    await safe(logAudit, {
      userId: user.id,
      action: "sessions.created",
      resource: `client:${client_id}`,
      metadata: { session_id: id, ip },
    });

    await safe(logEvent, {
      userId: user.id,
      type: "ai",
      event: "session_created",
      metadata: { session_id: id, client_id },
    });

    return NextResponse.json({ success: true, id });

  } catch (err: any) {
    await safe(logEvent, {
      userId: user?.id || "unknown",
      type: "error",
      event: "sessions.create.failed",
      metadata: { error: err?.message },
    });

    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

// =========================
// PATCH — UPDATE SESSION
// =========================
export async function PATCH(req: Request) {
  let user: any = null;

  try {
    const ip = extractIp(req);
    const ipAllowed = await rateLimit(`ip:${ip}`, 100, 60_000);
    if (!ipAllowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { data: auth } = await supabaseAdmin.auth.getUser();
    user = auth?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePro(user.id);

    const userAllowed = await rateLimit(`sessions:update:${user.id}`, 30, 60_000);
    if (!userAllowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const { session_id, client_id, ...fields } = body;

    if (!session_id) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    // ENCRYPT PHI FIELDS IF PRESENT
    const phiFields = [
      "behaviors_observed",
      "interventions_used",
      "client_response",
      "programs_targeted",
      "staff_member",
      "notes",
    ];

    const hasPHI = phiFields.some((f) => fields[f] !== undefined);
    const encrypted = hasPHI ? encryptSessionFields(fields) : {};

    const updateData = {
      ...fields,
      ...encrypted,
    };

    const { error } = await supabaseAdmin
      .from("sessions")
      .update(updateData)
      .eq("id", session_id);

    if (error) throw new Error(error.message);

    // INVALIDATE CACHE
    if (client_id) {
      await invalidateClientCache(client_id);
    }

    await safe(logAccess, {
      userId: user.id,
      resource: "sessions",
      action: "write",
      recordId: session_id,
      metadata: { containsPHI: hasPHI },
    });

    await safe(logAudit, {
      userId: user.id,
      action: "sessions.updated",
      resource: `session:${session_id}`,
      metadata: { session_id, ip },
    });

    await safe(logEvent, {
      userId: user.id,
      type: "ai",
      event: "session_updated",
      metadata: { session_id, client_id },
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    await safe(logEvent, {
      userId: user?.id || "unknown",
      type: "error",
      event: "sessions.update.failed",
      metadata: { error: err?.message },
    });

    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

// =========================
// DELETE — DELETE SESSION
// =========================
export async function DELETE(req: Request) {
  let user: any = null;

  try {
    const ip = extractIp(req);
    const ipAllowed = await rateLimit(`ip:${ip}`, 100, 60_000);
    if (!ipAllowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { data: auth } = await supabaseAdmin.auth.getUser();
    user = auth?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePro(user.id);

    const userAllowed = await rateLimit(`sessions:delete:${user.id}`, 20, 60_000);
    if (!userAllowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get("session_id");
    const client_id = searchParams.get("client_id");

    if (!session_id) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("sessions")
      .delete()
      .eq("id", session_id);

    if (error) throw new Error(error.message);

    // INVALIDATE CACHE
    if (client_id) {
      await invalidateClientCache(client_id);
    }

    await safe(logAccess, {
      userId: user.id,
      resource: "sessions",
      action: "delete",
      recordId: session_id,
      metadata: { ip },
    });

    await safe(logAudit, {
      userId: user.id,
      action: "sessions.deleted",
      resource: `session:${session_id}`,
      metadata: { session_id, ip },
    });

    await safe(logEvent, {
      userId: user.id,
      type: "ai",
      event: "session_deleted",
      metadata: { session_id, client_id },
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    await safe(logEvent, {
      userId: user?.id || "unknown",
      type: "error",
      event: "sessions.delete.failed",
      metadata: { error: err?.message },
    });

    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}