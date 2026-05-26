import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { to, message } = await req.json();

  if (!to || !message) {
    return NextResponse.json({ error: "to and message are required" }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  // SCAFFOLD — Twilio not yet configured
  if (!accountSid || !authToken || !fromNumber) {
    console.log(`[SMS SCAFFOLD] Would send to ${to}: ${message}`);
    return NextResponse.json({
      success: false,
      scaffold: true,
      message: "SMS scaffold ready. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env.local to activate.",
    });
  }

  // PRODUCTION — uncomment when Twilio is configured
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
      return NextResponse.json({ error: data.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, sid: data.sid });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}