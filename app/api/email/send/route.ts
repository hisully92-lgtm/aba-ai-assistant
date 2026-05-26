import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { to, subject, body, type } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@aba-ai.app";
  const fromName = process.env.RESEND_FROM_NAME ?? "ABA AI Assistant";

  if (!apiKey) {
    console.log(`[EMAIL SCAFFOLD] Would send to ${to}: ${subject}`);
    return NextResponse.json({
      success: false,
      scaffold: true,
      message: "Email scaffold ready. Add RESEND_API_KEY to .env.local to activate.",
    });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a2234; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 20px;">ABA AI Assistant</h1>
            </div>
            <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              ${body}
            </div>
            <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 16px;">
              ABA AI Assistant · HIPAA Compliant Practice Management
            </p>
          </div>
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}