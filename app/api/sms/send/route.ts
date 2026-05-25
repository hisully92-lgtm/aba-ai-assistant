import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { to, message } = await req.json();

    if (!to || !message) {
      return NextResponse.json({ error: "Missing to or message" }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !from) {
      return NextResponse.json({
        error: "SMS not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to your environment."
      }, { status: 503 });
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.message ?? "SMS failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, sid: data.sid });

  } catch (err: unknown) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "SMS failed"
    }, { status: 500 });
  }
}