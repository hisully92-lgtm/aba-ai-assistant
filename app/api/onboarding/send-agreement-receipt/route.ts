import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await fetch(process.env.NEXT_PUBLIC_SITE_URL + "/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body: html }),
    });
  } catch {}
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await request.json();
    const { clinicName, signatoryName, agreementType, role } = body;

    if (!clinicName || !signatoryName || !agreementType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const isOrgBaa = agreementType === "org_baa";
    const signedAt = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

    const subject = isOrgBaa
      ? `Signed: HIPAA Business Associate Agreement — ${clinicName}`
      : `Signed: HIPAA Workforce Acknowledgment — ${clinicName}`;

    const html = isOrgBaa
      ? `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2>HIPAA Business Associate Agreement — Signed</h2>
          <p>This confirms that a Business Associate Agreement between <strong>${clinicName}</strong> and ABA AI Assistant was signed electronically.</p>
          <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0;">
            <p><strong>Signed by:</strong> ${signatoryName}</p>
            <p><strong>On behalf of:</strong> ${clinicName}</p>
            <p><strong>Date/time:</strong> ${signedAt}</p>
          </div>
          <p style="color:#666;font-size:13px;">Keep this email as your record. A copy of this signature is also stored in your account's compliance records.</p>
        </div>
      `
      : `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2>HIPAA Workforce Acknowledgment — Signed</h2>
          <p>This confirms you electronically signed a HIPAA workforce confidentiality acknowledgment as a member of <strong>${clinicName}</strong>.</p>
          <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0;">
            <p><strong>Signed by:</strong> ${signatoryName}</p>
            <p><strong>Clinic:</strong> ${clinicName}</p>
            <p><strong>Role:</strong> ${role || "Staff"}</p>
            <p><strong>Date/time:</strong> ${signedAt}</p>
          </div>
          <p style="color:#666;font-size:13px;">Keep this email as your record. A copy of this signature is also stored in your account's compliance records.</p>
        </div>
      `;

    await sendEmail(user.email!, subject, html);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Agreement receipt email error:", error);
    return NextResponse.json({ error: "Failed to send receipt" }, { status: 500 });
  }
}
