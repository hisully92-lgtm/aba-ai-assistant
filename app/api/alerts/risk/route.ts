import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { clientId, risk } = body;

    if (!clientId || !risk) {
      return NextResponse.json(
        { error: "Missing data" },
        { status: 400 }
      );
    }

    await resend.emails.send({
      from: "Clinical Alerts <alerts@yourapp.com>",
      to: process.env.ALERT_EMAIL!,
      subject: `🚨 High Risk Alert: Client ${clientId}`,
      html: `
        <h2>Risk Alert Triggered</h2>
        <p><strong>Client ID:</strong> ${clientId}</p>
        <p><strong>Risk Level:</strong> ${risk}</p>
        <p>This client requires immediate supervisor review.</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to send alert" },
      { status: 500 }
    );
  }
}