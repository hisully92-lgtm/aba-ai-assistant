import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { to, message, companyId, triggerType } = await req.json();

  if (!to || !message) {
    return NextResponse.json({ error: "to and message are required" }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({
      success: false,
      error: "Twilio not configured",
    }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: message }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Log failed attempt
      if (companyId) {
        await supabaseAdmin.from("sms_logs").insert({
          company_id: companyId,
          to_number: to,
          message,
          trigger_type: triggerType ?? "manual",
          status: "failed",
        });
      }
      return NextResponse.json({ error: data.message }, { status: 400 });
    }

    // Log successful send
    if (companyId) {
      await supabaseAdmin.from("sms_logs").insert({
        company_id: companyId,
        to_number: to,
        message,
        trigger_type: triggerType ?? "manual",
        status: "sent",
        twilio_sid: data.sid,
      });
    }

    return NextResponse.json({ success: true, sid: data.sid });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
