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

  const { data: trials, error } = await supabaseAdmin
    .from("subscription_contracts")
    .select("id, plan_name, plan_type, end_date, company_id, user_id, price_per_month, contract_length_months")
    .eq("status", "trial")
    .eq("reminder_sent", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  let remindersSent = 0;

  for (const trial of trials ?? []) {
    const endDate = new Date(trial.end_date);
    const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilEnd <= 7 && daysUntilEnd >= 0) {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("name")
        .eq("id", trial.company_id)
        .single();

      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(trial.user_id);

      await sendGeneralEmail({
        to: "hello@aba-ai-assistant.com",
        subject: "Trial ending soon: " + (company?.name || "Unknown clinic"),
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
            <h2>Trial Ending Soon</h2>
            <p><b>Clinic:</b> ${company?.name || "Unknown"}</p>
            <p><b>Contact:</b> ${authUser?.user?.email || "Unknown"}</p>
            <p><b>Plan:</b> ${trial.plan_name} (${trial.contract_length_months} months)</p>
            <p><b>Trial ends:</b> ${trial.end_date} (in ${daysUntilEnd} days)</p>
            <p><b>Amount due at renewal:</b> $${trial.price_per_month}/mo</p>
            <p style="color:#666;font-size:13px;margin-top:20px;">Send them a Square payment link to collect real payment before the trial ends.</p>
          </div>
        `,
      });

      await supabaseAdmin
        .from("subscription_contracts")
        .update({ reminder_sent: true })
        .eq("id", trial.id);

      remindersSent++;
    }
  }

  return NextResponse.json({ success: true, checked: trials?.length ?? 0, remindersSent });
}
