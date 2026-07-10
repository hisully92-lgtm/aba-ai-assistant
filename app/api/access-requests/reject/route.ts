import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGeneralEmail } from "@/lib/email";
import { verifyToken } from "@/lib/access-tokens";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { token, reason } = await req.json();
  const payload = verifyToken(token);
  if (!payload || !payload.startsWith("reject:")) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }
  const requestId = payload.split(":")[1];

  const { data: request } = await supabaseAdmin
    .from("access_requests")
    .update({ status: "rejected", rejection_reason: reason, decided_at: new Date().toISOString() })
    .eq("id", requestId)
    .select()
    .single();

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 400 });

  await sendGeneralEmail({
    to: request.contact_email,
    subject: `Update on your ABA AI Assistant request`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <p>Hi ${request.contact_name},</p>
        <p>Thank you for your interest in ABA AI Assistant. After review, we're not able to move forward with your request at this time.</p>
        ${reason ? `<p><b>Reason:</b> ${reason}</p>` : ""}
        <p>If you have questions or believe this was in error, feel free to reply to this email.</p>
        <p>â€” The ABA AI Assistant Team</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}
