import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendLocationConfirmationEmail } from "@/lib/email";

function generateAdminCode(clinicCode: string): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const year = new Date().getFullYear();
  return clinicCode + "-ADMI-" + year + "-" + random;
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await fetch(process.env.NEXT_PUBLIC_SITE_URL + "/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body: html }),
    });
  } catch {}
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: pending } = await supabaseAdmin
      .from("pending_onboarding")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending_payment")
      .maybeSingle();

    if (!pending) {
      return NextResponse.json({ error: "No pending onboarding found" }, { status: 404 });
    }

    await supabaseAdmin.from("profiles").upsert({
      id: user.id,
      full_name: pending.name,
      role: pending.role,
      updated_at: new Date().toISOString(),
    });

    let companyId = "";
    let newClinicCode = "";
    let generatedAdminCode = "";

    if (pending.join_existing) {
      const { data: existingCompany } = await supabaseAdmin
        .from("companies")
        .select("id")
        .ilike("clinic_code", pending.clinic_code)
        .maybeSingle();

      if (!existingCompany) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
      companyId = existingCompany.id;
    } else {
      const slug = pending.clinic_name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      newClinicCode = rand(4) + "-" + rand(4);

      const isFreeTrial = !!pending.is_free_trial;

      const { data: company } = await supabaseAdmin
        .from("companies")
        .insert({
          name: pending.clinic_name,
          slug,
          clinic_code: newClinicCode,
          free_trial_used: isFreeTrial,
        })
        .select()
        .single();

      if (!company) return NextResponse.json({ error: "Failed to create clinic" }, { status: 500 });
      companyId = company.id;

      if (pending.hipaa_signature) {
        await supabaseAdmin.from("hipaa_agreements").insert({
          user_id: user.id,
          clinic_name: pending.clinic_name,
          signatory_name: pending.hipaa_signature,
          agreed_at: new Date().toISOString(),
        });
      }

      const locs = JSON.parse(pending.locations ?? "[]");
      for (const loc of locs) {
        if (loc.name?.trim() || loc.address?.trim()) {
          await supabaseAdmin.from("locations").insert({
            company_id: companyId,
            name: loc.name?.trim() || pending.clinic_name,
            address: loc.address?.trim() || null,
            city: loc.city?.trim() || null,
            state: loc.state?.trim() || null,
            zip: loc.zip?.trim() || null,
          });
        }
      }

      generatedAdminCode = generateAdminCode(newClinicCode);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);

      await supabaseAdmin.from("role_codes").insert({
        code: generatedAdminCode,
        role: "admin",
        used: false,
        expires_at: expiryDate.toISOString().split("T")[0],
        company_id: companyId,
        created_by: user.id,
      });

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + pending.months);

      await supabaseAdmin.from("subscription_contracts").insert({
        user_id: user.id,
        company_id: companyId,
        plan_name: pending.plan_label,
        plan_type: pending.plan_type,
        contract_length_months: pending.months,
        price_per_month: pending.price_per_month,
        total_price: isFreeTrial ? pending.total_price - pending.price_per_month : pending.total_price,
        discount_percent: isFreeTrial ? Math.round((pending.price_per_month / pending.total_price) * 100) : 0,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        auto_renew: true,
        renewal_reminder_days: isFreeTrial ? 23 : 30,
        status: isFreeTrial ? "trial" : "active",
        payment_method: "Square",
      });

      const emailTo = pending.code_email || user.email || "";
      if (pending.code_preference === "email" || pending.code_preference === "both") {
        await sendEmail(
          emailTo,
          "Your ABA AI Assistant Clinic Codes",
          "<h2>Welcome to ABA AI Assistant!</h2><p>Hi " + pending.name + ",</p><p>Your payment was confirmed and your clinic is now active.</p><div style=\"background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0;\"><p><strong>Clinic Name:</strong> " + pending.clinic_name + "</p><p><strong>Clinic Code:</strong> <code style=\"font-size:18px;font-weight:bold;\">" + newClinicCode + "</code></p><p><strong>Admin Setup Code:</strong> <code style=\"font-size:18px;font-weight:bold;\">" + generatedAdminCode + "</code></p><p style=\"color:#dc2626;font-size:12px;\">Admin code expires in 7 days and can only be used once.</p></div><p>Share the Clinic Code with your staff so they can join your clinic.</p>"
        );
      }

      await sendEmail(
        "hisully92@gmail.com",
        "New Clinic Signed Up: " + pending.clinic_name,
        "<h2>New Paid Clinic Registration</h2><p><strong>Clinic:</strong> " + pending.clinic_name + "</p><p><strong>Admin:</strong> " + pending.name + "</p><p><strong>Email:</strong> " + user.email + "</p><p><strong>Plan:</strong> " + pending.plan_label + " - " + pending.months + " month(s) - $" + pending.price_per_month + "/mo</p><p><strong>Billing:</strong> " + (isFreeTrial ? "FREE FIRST MONTH - real billing starts " + endDate.toISOString().split("T")[0] : "Charged in full via Square") + "</p><p><strong>Clinic Code:</strong> " + newClinicCode + "</p><p><strong>Admin Code:</strong> " + generatedAdminCode + "</p><p><strong>Nonprofit:</strong> " + (pending.is_nonprofit ? "Yes - EIN: " + pending.nonprofit_ein : "No") + "</p>"
      );
    }

    await supabaseAdmin.from("company_users").upsert({
      company_id: companyId,
      user_id: user.id,
      role: pending.role,
      status: "active",
    });

    await supabaseAdmin.from("pending_onboarding")
      .update({ status: "complete" })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      clinicCode: newClinicCode,
      adminCode: generatedAdminCode,
      companyId,
    });

  } catch (err: any) {
    console.error("Onboarding complete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
