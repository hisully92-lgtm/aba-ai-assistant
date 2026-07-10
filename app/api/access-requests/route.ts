import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGeneralEmail } from "@/lib/email";
import { signToken } from "@/lib/access-tokens";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLANS = [
  { id: "starter", label: "Starter", price: "$199/mo" },
  { id: "basic", label: "Basic", price: "$299/mo" },
  { id: "professional", label: "Professional", price: "$449/mo" },
  { id: "growth", label: "Growth", price: "$649/mo" },
  { id: "enterprise", label: "Enterprise", price: "$849/mo" },
  { id: "clinic", label: "Clinic", price: "$1,099/mo" },
];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orgName, contactName, contactEmail, verificationType, verificationValue } = body;

  if (!orgName || !contactName || !contactEmail || !verificationType || !verificationValue) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: request, error } = await supabaseAdmin
    .from("access_requests")
    .insert({
      org_name: orgName,
      contact_name: contactName,
      contact_email: contactEmail,
      verification_type: verificationType,
      verification_value: verificationValue,
      status: "submitted",
    })
    .select()
    .single();

  if (error || !request) {
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }

  const planLinks = PLANS.map((plan) => {
    const token = signToken(`${request.id}:${plan.id}`);
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/access-requests/select-plan?token=${token}`;
    return `<a href="${url}" style="display:block;padding:14px 20px;margin:8px 0;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:8px;font-family:sans-serif;">${plan.label} — ${plan.price}</a>`;
  }).join("");

  await sendGeneralEmail({
    to: contactEmail,
    subject: "Choose your plan — ABA AI Assistant",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Thanks for your interest, ${contactName}!</h2>
        <p>Please select the plan that fits ${orgName}:</p>
        ${planLinks}
        <p style="color:#666;font-size:13px;margin-top:24px;">Once selected, our team will review your request and follow up shortly.</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}