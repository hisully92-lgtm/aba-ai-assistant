import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createLocationSubscriptionLink } from "@/lib/square";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const {
      companyId, locationName, billingType,
      address, city, state, zip, phone, lat, lng, radius,
    } = await req.json();

    if (!companyId || !locationName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: pending, error: pendingError } = await supabaseAdmin
      .from("pending_location_payments")
      .insert({
        company_id: companyId,
        user_id: user.id,
        location_name: locationName,
        billing_type: billingType,
        admin_email: profile?.email ?? user.email,
        admin_name: profile?.full_name ?? "Admin",
        company_name: company?.name ?? "Your Clinic",
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        phone: phone || null,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        radius: radius ? parseInt(radius) : 300,
        status: "pending",
      })
      .select()
      .single();

    if (pendingError || !pending) {
      return NextResponse.json({ error: "Failed to create pending payment record" }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aba-ai-assistant.com";
    const redirectUrl = `${siteUrl}/dashboard/admin/locations?location_success=true`;

    const result = await createLocationSubscriptionLink(user.id, companyId, pending.id, redirectUrl);

    const url = result?.payment_link?.url;
    const orderId = result?.payment_link?.order_id ?? result?.related_resources?.orders?.[0]?.id ?? null;

    if (!url) {
      return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
    }

    await supabaseAdmin
      .from("pending_location_payments")
      .update({ payment_link_url: url, order_id: orderId })
      .eq("id", pending.id);

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("Location checkout error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
