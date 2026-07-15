import { NextRequest, NextResponse } from "next/server";

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await fetch(process.env.NEXT_PUBLIC_SITE_URL + "/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body: html }),
    });
  } catch {}
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, companyName, phone, preferredTime, notes } = body;

  if (!name || !email || !companyName) {
    return NextResponse.json({ error: "Name, email, and organization name are required" }, { status: 400 });
  }

  await sendEmail(
    "hisully92@gmail.com",
    "Demo Requested: " + companyName,
    `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Live Demo Requested</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Organization:</strong> ${companyName}</p>
        <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
        <p><strong>Preferred time:</strong> ${preferredTime || "No preference given"}</p>
        <p><strong>Notes:</strong> ${notes || "None"}</p>
        <p style="color:#666;font-size:13px;margin-top:20px;">Reach out to schedule a live walkthrough.</p>
      </div>
    `
  );

  return NextResponse.json({ success: true });
}
