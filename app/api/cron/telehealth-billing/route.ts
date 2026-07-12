import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_PRICE = 60;
const INCLUDED_MINUTES = 300;
const OVERAGE_RATE_PER_MINUTE = 0.05;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bill for the previous full calendar month
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const { data: activeAddons, error: addonsError } = await supabaseAdmin
    .from("company_addons")
    .select("company_id")
    .eq("addon_type", "video")
    .eq("status", "active");

  if (addonsError) {
    return NextResponse.json({ error: addonsError.message }, { status: 500 });
  }

  const results: { companyId: string; amount: number; minutesUsed: number; skipped?: string }[] = [];

  for (const addon of activeAddons ?? []) {
    const companyId = addon.company_id;

    // Skip if already invoiced for this period
    const periodLabel = periodStart.toISOString().slice(0, 7); // YYYY-MM
    const invoiceNumber = `TH-${companyId.slice(0, 8)}-${periodLabel}`;

    const { data: existingInvoice } = await supabaseAdmin
      .from("company_invoices")
      .select("id")
      .eq("invoice_number", invoiceNumber)
      .maybeSingle();

    if (existingInvoice) {
      results.push({ companyId, amount: 0, minutesUsed: 0, skipped: "already invoiced" });
      continue;
    }

    const { data: usageRows } = await supabaseAdmin
      .from("addon_usage_log")
      .select("units_used")
      .eq("company_id", companyId)
      .eq("addon_type", "video")
      .gte("period_start", periodStart.toISOString())
      .lt("period_start", periodEnd.toISOString());

    const minutesUsed = (usageRows ?? []).reduce((sum, row) => sum + Number(row.units_used || 0), 0);
    const overageMinutes = Math.max(0, minutesUsed - INCLUDED_MINUTES);
    const overageAmount = Math.round(overageMinutes * OVERAGE_RATE_PER_MINUTE * 100) / 100;
    const totalAmount = BASE_PRICE + overageAmount;

    const description =
      `Telehealth Video — ${periodLabel}: $${BASE_PRICE} base (${INCLUDED_MINUTES} min included)` +
      (overageMinutes > 0
        ? ` + ${overageMinutes} min overage @ $${OVERAGE_RATE_PER_MINUTE}/min = $${overageAmount.toFixed(2)}`
        : ` (used ${minutesUsed} min, no overage)`);

    const { error: insertError } = await supabaseAdmin.from("company_invoices").insert({
      company_id: companyId,
      invoice_number: invoiceNumber,
      description,
      amount: totalAmount,
      status: "pending",
      billing_period_start: periodStart.toISOString().slice(0, 10),
      billing_period_end: new Date(periodEnd.getTime() - 86400000).toISOString().slice(0, 10),
    });

    if (insertError) {
      console.error(`Failed to create telehealth invoice for company ${companyId}:`, insertError);
      results.push({ companyId, amount: 0, minutesUsed, skipped: "insert failed" });
      continue;
    }

    results.push({ companyId, amount: totalAmount, minutesUsed });
  }

  return NextResponse.json({ processed: results.length, results });
}
