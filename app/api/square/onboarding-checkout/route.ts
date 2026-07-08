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

    const body = await req.json();
    const {
      name, clinicName, planType, planLabel, months, pricePerMonth,
      role, hipaaSignature, locations, codePreference, codeEmail,
      isNonprofit, nonprofitEin, joinExisting, clinicCode, verificationCode,
      verificationType, businessEin, bcbaCertNumber,
    } = body;

    // Server-side enforcement: new clinics must provide an EIN or BCBA cert — can't be bypassed by calling this API directly
    if (!joinExisting) {
      const hasEin = verificationType === "ein" && businessEin?.trim();
      const hasBcba = verificationType === "bcba" && bcbaCertNumber?.trim();
      if (!hasEin && !hasBcba) {
        return NextResponse.json({ error: "Business EIN or BCBA certification number is required to create a new clinic." }, { status: 400 });
      }
    }

    // Apply nonprofit discount to stored price if applicable
    const NONPROFIT_DISCOUNT = 0.20;
    const effectivePrice = isNonprofit && nonprofitEin
      ? Math.round(pricePerMonth * (1 - NONPROFIT_DISCOUNT))
      : pricePerMonth;

    const { data: pending, error: pendingError } = await supabaseAdmin
      .from("pending_onboarding")
      .upsert({
        user_id: user.id,
        name,
        clinic_name: clinicName,
        plan_type: planType,
        plan_label: planLabel,
        months,
        price_per_month: effectivePrice,
        total_price: effectivePrice * months,
        role,
        hipaa_signature: hipaaSignature,
        locations: JSON.stringify(locations),
        code_preference: codePreference,
        code_email: codeEmail,
        is_nonprofit: isNonprofit,
        nonprofit_ein: nonprofitEin,
        verification_type: verificationType,
        business_ein: businessEin,
        bcba_cert_number: bcbaCertNumber,
        join_existing: joinExisting,
        clinic_code: clinicCode,
        verification_code: verificationCode,
        status: "pending_payment",
      }, { onConflict: "user_id" })
      .select()
      .maybeSingle();

    if (pendingError) {
      return NextResponse.json({ error: pendingError.message }, { status: 500 });
    }

    const result = await createSquarePaymentLink(
      user.id,
      planType,
      months,
      `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/complete?success=true`,
      isNonprofit,
      nonprofitEin
    );

    const url = result?.payment_link?.url ?? result?.paymentLink?.url;
    if (!url) {
      return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
    }

    return NextResponse.json({ url, pendingId: pending?.id });
  } catch (err: any) {
    console.error("Onboarding checkout error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
