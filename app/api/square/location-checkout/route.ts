import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSquarePaymentLink } from "@/lib/square";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { companyId, locationName, billingType } = await req.json();
    if (!companyId || !locationName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get company info
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    // Get admin email
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const result = await createSquarePaymentLink(user.id, "location_addon", 1);
    const url = result?.payment_link?.url ?? result?.paymentLink?.url;

    if (!url) {
      return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
    }

    // Store pending location payment
    await supabaseAdmin.from("pending_location_payments").insert({
      company_id: companyId,
      user_id: user.id,
      location_name: locationName,
      billing_type: billingType,
      admin_email: profile?.email ?? user.email,
      admin_name: profile?.full_name ?? "Admin",
      company_name: company?.name ?? "Your Clinic",
      payment_link_url: url,
      status: "pending",
    });

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("Location checkout error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
