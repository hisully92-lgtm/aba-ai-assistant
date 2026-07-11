import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGeneralEmail } from "@/lib/email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: overdueContracts, error } = await supabaseAdmin
    .from("subscription_contracts")
    .select("id, user_id, company_id, plan_name, end_date, price_per_month")
    .in("status", ["active", "trial"])
    .lt("end_date", today)
    .eq("overdue_notified", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let flagged = 0;

  for (const contract of overdueContracts ?? []) {
    let companyId = contract.company_id;
    let companyName = "Unknown";

    if (!companyId) {
      const { data: companyUser } = await supabaseAdmin
        .from("company_users")
        .select("company_id")
        .eq("user_id", contract.user_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      companyId = companyUser?.company_id ?? null;
    }

    if (companyId) {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .single();
      companyName = company?.name || "Unknown";

      await supabaseAdmin.from("company_invoices").insert({
        company_id: companyId,
        invoice_number: "OVERDUE-" + contract.id,
        description: (contract.plan_name ?? "Plan") + " renewal overdue",
        amount: contract.price_per_month ?? 0,
        status: "failed",
      });
    }

    await supabaseAdmin
      .from("subscription_contracts")
      .update({ overdue_notified: true })
      .eq("id", contract.id);

    await supabaseAdmin
      .from("profiles")
      .update({ subscription_status: "past_due" })
      .eq("id", contract.user_id);

    await sendGeneralEmail({
      to: "hello@aba-ai-assistant.com",
      subject: "Overdue renewal: " + companyName,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2>Renewal Overdue</h2>
          <p><b>Company:</b> ${companyName}</p>
          <p><b>Plan:</b> ${contract.plan_name}</p>
          <p><b>Was due:</b> ${contract.end_date}</p>
          <p><b>Amount:</b> $${contract.price_per_month}/mo</p>
          <p style="color:#666;font-size:13px;margin-top:20px;">No Square payment was received for this renewal. Reach out to collect payment or resolve billing.</p>
        </div>
      `,
    });

    flagged++;
  }

  return NextResponse.json({ success: true, checked: overdueContracts?.length ?? 0, flagged });
}
