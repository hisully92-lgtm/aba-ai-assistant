import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// Default plan terms — kept in sync with the standalone (company-wide)
// add-on pricing already used elsewhere (telehealth video / SMS settings).
const ADDON_DEFAULTS: Record<string, { monthly_price: number; included_units: number; overage_rate: number }> = {
  telehealth_video: { monthly_price: 60, included_units: 3000, overage_rate: 0.025 },
  sms: { monthly_price: 35, included_units: 2000, overage_rate: 0.02 },
};

export async function POST(req: NextRequest) {
  try {
    const { companyId, companyName, locationId, locationName, addonType, requestedBy } = await req.json();

    if (!companyId || !locationId || !addonType) {
      return NextResponse.json({ error: "companyId, locationId, and addonType are required" }, { status: 400 });
    }

    const defaults = ADDON_DEFAULTS[addonType];
    if (!defaults) {
      return NextResponse.json({ error: "Unknown addon type" }, { status: 400 });
    }

    // Don't create a duplicate if this location already has a pending/active
    // add-on of this type.
    const { data: existing } = await supabaseAdmin
      .from("company_addons")
      .select("id, status")
      .eq("company_id", companyId)
      .eq("location_id", locationId)
      .eq("addon_type", addonType)
      .in("status", ["pending", "active"])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: `This location already has a ${existing.status} request for this add-on.` }, { status: 409 });
    }

    const { data: addon, error } = await supabaseAdmin
      .from("company_addons")
      .insert({
        company_id: companyId,
        location_id: locationId,
        addon_type: addonType,
        status: "pending",
        monthly_price: defaults.monthly_price,
        included_units: defaults.included_units,
        overage_rate: defaults.overage_rate,
      })
      .select()
      .single();

    if (error || !addon) {
      return NextResponse.json({ error: error?.message ?? "Failed to create add-on request" }, { status: 500 });
    }

    // Fire the same admin notification pattern used for location requests,
    // so this shows up wherever you already review pending upgrade requests.
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/request-upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          companyName,
          currentPlan: "current",
          requestedPlan: `${addonType === "telehealth_video" ? "Telehealth Video" : "SMS"} add-on ($${defaults.monthly_price}/mo)`,
          resourceType: `location add-on: ${locationName ?? locationId}`,
        }),
      });
    } catch (notifyErr) {
      console.error("Add-on request notification failed:", notifyErr);
    }

    return NextResponse.json({ success: true, addon });
  } catch (err: any) {
    console.error("request-addon error:", err);
    return NextResponse.json({ error: "Failed to request add-on" }, { status: 500 });
  }
}
