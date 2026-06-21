import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scheduleEntryId, companyId, clientId, date, startTime, sessionType } = body;

    if (!scheduleEntryId || !companyId || !clientId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await supabaseAdmin.from("jobs").insert({
      status: "pending",
      attempts: 0,
      payload: {
        type: "session_cancellation_sms",
        scheduleEntryId,
        companyId,
        clientId,
        date,
        startTime,
        sessionType,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
