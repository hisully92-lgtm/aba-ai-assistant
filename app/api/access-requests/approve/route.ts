import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGeneralEmail } from "@/lib/email";
import { verifyToken } from "@/lib/access-tokens";
import { createSquarePaymentLink } from "@/lib/square";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Invalid link" }, { status: 400 });

  const payload = verifyToken(token);
  if (!payload || !payload.startsWith("approve:")) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  }
  const requestId = payload.split(":")[1];

  const { data: request } = await supabaseAdmin
    .from("access_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "plan_selected") {
    return NextResponse.json({ error: "Request not found or already handled" }, { status: 400 });
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from("companies")
    .insert({
      name: request.org_name,
      plan: request.selected_plan,
      ein_or_bcba: request.verification_value,
      status: "pending_billing",
    })
    .select()
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");
  await supabaseAdmin.from("invite_tokens").insert({
    token: inviteToken,
    access_request_id: request.id,
    company_id: company.id,
    contact_email: request.contact_email,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`;

  let paymentUrl = "";
  try {
    const paymentLinkData = await createSquarePaymentLink(
      company.id,
      request.selected_plan,
      1,
      redirectUrl,
      false,
      "",
      { extraMetadata: { companyId: company.id, accessRequestId: request.id } }
    );
    paymentUrl = paymentLinkData.payment_link.url;
  } catch (err) {
    console.error("Failed to create Square payment link:", err);
    return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
  }

  await supabaseAdmin
    .from("access_requests")
    .update({ status: "approved", company_id: company.id, decided_at: new Date().toISOString() })
    .eq("id", requestId);

  await sendGeneralEmail({
    to: request.contact_email,
    subject: "You're approved! Complete your ABA AI Assistant setup",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Welcome, ${request.org_name}!</h2>
        <p>You've been approved for the ${request.selected_plan} plan. Complete these two quick steps to get started:</p>
        <p><b>Step 1:</b></p>
        <a href="${paymentUrl}" style="display:inline-block;padding:14px 24px;background:#22c55e;color:#fff;text-decoration:none;border-radius:8px;">Complete Billing Setup</a>
        <p style="margin-top:20px;"><b>Step 2:</b></p>
        <a href="${redirectUrl}" style="display:inline-block;padding:14px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:8px;">Set Up My Account</a>
      </div>
    `,
  });

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin/approved`);
}