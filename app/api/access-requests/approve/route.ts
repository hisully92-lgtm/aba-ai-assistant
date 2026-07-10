import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { verifyToken } from "@/lib/access-tokens";
import crypto from "crypto";
// import your existing Square client helper here, e.g.:
// import { squareClient } from "@/lib/square";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

const PLAN_VARIATION_IDS: Record<string, string> = {
  // fill in each plan's actual Square Catalog plan variation ID
  starter: "REPLACE_ME",
  professional: "REPLACE_ME",
  growth: "REPLACE_ME",
  enterprise: "REPLACE_ME",
  clinic: "REPLACE_ME",
};

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

  // 1. Create company
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

  // 2. Create Square customer + subscription (Square auto-invoices when no card on file)
  // Adjust this block to match your existing Square helper/client pattern
  /*
  const customerResponse = await squareClient.customersApi.createCustomer({
    givenName: request.contact_name,
    emailAddress: request.contact_email,
    companyName: request.org_name,
  });
  const customerId = customerResponse.result.customer.id;

  await squareClient.subscriptionsApi.createSubscription({
    idempotencyKey: crypto.randomUUID(),
    locationId: process.env.SQUARE_LOCATION_ID!,
    planVariationId: PLAN_VARIATION_IDS[request.selected_plan],
    customerId,
  });
  */

  // 3. Generate invite token
  const inviteToken = crypto.randomBytes(32).toString("hex");
  await supabaseAdmin.from("invite_tokens").insert({
    token: inviteToken,
    access_request_id: request.id,
    company_id: company.id,
    contact_email: request.contact_email,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  });

  // 4. Update request status
  await supabaseAdmin
    .from("access_requests")
    .update({ status: "approved", company_id: company.id, decided_at: new Date().toISOString() })
    .eq("id", requestId);

  // 5. Email clinic their invite
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`;
  await resend.emails.send({
    from: "hello@aba-ai-assistant.com",
    to: request.contact_email,
    subject: "You're approved! Set up your ABA AI Assistant account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Welcome, ${request.org_name}!</h2>
        <p>You've been approved for the ${request.selected_plan} plan. You'll receive a Square invoice shortly for your first billing cycle.</p>
        <p>Click below to set up your account:</p>
        <a href="${inviteUrl}" style="display:inline-block;padding:14px 24px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:8px;">Set Up My Account</a>
      </div>
    `,
  });

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin/approved`);
}