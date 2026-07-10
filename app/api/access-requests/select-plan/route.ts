import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGeneralEmail } from "@/lib/email";
import { signToken, verifyToken } from "@/lib/access-tokens";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/request-access/error`);

  const payload = verifyToken(token);
  if (!payload) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/request-access/error`);

  const [requestId, plan] = payload.split(":");

  const { data: request } = await supabaseAdmin
    .from("access_requests")
    .update({ selected_plan: plan, status: "plan_selected" })
    .eq("id", requestId)
    .select()
    .single();

  if (!request) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/request-access/error`);

  const approveToken = signToken(`approve:${requestId}`);
  const rejectToken = signToken(`reject:${requestId}`);
  const approveUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/access-requests/approve?token=${approveToken}`;
  const rejectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/request-access/reject?token=${rejectToken}`;

  await sendGeneralEmail({
    to: "hello@aba-ai-assistant.com",
    subject: `New clinic request: ${request.org_name} (${plan})`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>${request.org_name}</h2>
        <p><b>Contact:</b> ${request.contact_name} — ${request.contact_email}</p>
        <p><b>${request.verification_type.toUpperCase()}:</b> ${request.verification_value}</p>
        <p><b>Selected plan:</b> ${plan}</p>
        <div style="margin-top:20px;">
          <a href="${approveUrl}" style="padding:12px 24px;background:#22c55e;color:#fff;text-decoration:none;border-radius:8px;margin-right:10px;">✓ Approve</a>
          <a href="${rejectUrl}" style="padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;border-radius:8px;">✗ Reject</a>
        </div>
      </div>
    `,
  });

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/request-access/thank-you`);
}