"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function generateAdminCode(clinicCode: string): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const year = new Date().getFullYear();
  return `${clinicCode}-ADMI-${year}-${random}`;
}

async function sendEmail(to: string, subject: string, body: string) {
  try {
    await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body }),
    });
  } catch {}
}

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Setting up your clinic...");
  const [clinicCode, setClinicCode] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [copied, setCopied] = useState<"clinic" | "admin" | null>(null);

  useEffect(() => { complete(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function complete() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Get pending onboarding record
      const { data: pending } = await supabase
        .from("pending_onboarding")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending_payment")
        .maybeSingle();

      if (!pending) {
        // Already completed or no pending record
        router.push("/dashboard");
        return;
      }

      setMessage("Creating your clinic...");

      // Update profile
      await supabase.from("profiles").upsert({
        id: user.id,
        full_name: pending.name,
        role: pending.role,
        updated_at: new Date().toISOString(),
      });

      let companyId = "";
      let newClinicCode = "";

      if (pending.join_existing) {
        const { data: existingCompany } = await supabase
          .from("companies")
          .select("id")
          .ilike("clinic_code", pending.clinic_code)
          .maybeSingle();

        if (!existingCompany) throw new Error("Clinic not found");
        companyId = existingCompany.id;
      } else {
        // Create company
        const slug = pending.clinic_name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        const { data: company } = await supabase
          .from("companies")
          .insert({ name: pending.clinic_name, slug })
          .select()
          .single();

        if (!company) throw new Error("Failed to create clinic");
        companyId = company.id;

        // Generate clinic code
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        newClinicCode = `${rand(4)}-${rand(4)}`;
        await supabase.from("companies").update({ clinic_code: newClinicCode }).eq("id", company.id);
        setClinicCode(newClinicCode);

        // Save HIPAA agreement
        if (pending.hipaa_signature) {
          await supabase.from("hipaa_agreements").insert({
            user_id: user.id,
            clinic_name: pending.clinic_name,
            signatory_name: pending.hipaa_signature,
            agreed_at: new Date().toISOString(),
          });
        }

        // Save locations
        const locs = JSON.parse(pending.locations ?? "[]");
        for (const loc of locs) {
          if (loc.name?.trim() || loc.address?.trim()) {
            await supabase.from("locations").insert({
              company_id: companyId,
              name: loc.name?.trim() || pending.clinic_name,
              address: loc.address?.trim() || null,
              city: loc.city?.trim() || null,
              state: loc.state?.trim() || null,
              zip: loc.zip?.trim() || null,
            });
          }
        }

        setMessage("Setting up your admin account...");

        // Generate admin code
        const generatedAdminCode = generateAdminCode(newClinicCode);
        setAdminCode(generatedAdminCode);

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);
        await supabase.from("role_codes").insert({
          code: generatedAdminCode,
          role: "admin",
          used: false,
          expires_at: expiryDate.toISOString().split("T")[0],
          company_id: companyId,
          created_by: user.id,
        });

        // Create subscription contract
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);
        await supabase.from("subscription_contracts").insert({
          user_id: user.id,
          company_id: companyId,
          plan_name: pending.plan_label,
          plan_type: pending.plan_type,
          contract_length_months: pending.months,
          price_per_month: pending.price_per_month,
          total_price: 0,
          discount_percent: 100,
          start_date: new Date().toISOString().split("T")[0],
          end_date: trialEnd.toISOString().split("T")[0],
          auto_renew: true,
          renewal_reminder_days: 7,
          status: "trial",
          payment_method: "Square",
        });

        // Send codes email
        const emailTo = pending.code_email || user.email || "";
        if (pending.code_preference === "email" || pending.code_preference === "both") {
          await sendEmail(
            emailTo,
            "Your ABA AI Assistant Clinic Codes",
            `
              <h2>Welcome to ABA AI Assistant!</h2>
              <p>Hi ${pending.name},</p>
              <p>Your payment was confirmed and your clinic is now active. Here are your codes:</p>
              <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0;">
                <p><strong>Clinic Name:</strong> ${pending.clinic_name}</p>
                <p><strong>Clinic Code:</strong> <code style="font-size:18px;font-weight:bold;">${newClinicCode}</code></p>
                <p><strong>Admin Setup Code:</strong> <code style="font-size:18px;font-weight:bold;">${generatedAdminCode}</code></p>
                <p style="color:#dc2626;font-size:12px;">Admin code expires in 7 days and can only be used once.</p>
              </div>
              <p>Share the Clinic Code with your staff so they can join your clinic.</p>
            `
          );
        }

        // Notify Heidi
        await sendEmail(
          "hisully92@gmail.com",
          `New Clinic Signed Up: ${pending.clinic_name}`,
          `
            <h2>New Paid Clinic Registration</h2>
            <p><strong>Clinic:</strong> ${pending.clinic_name}</p>
            <p><strong>Admin:</strong> ${pending.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Plan:</strong> ${pending.plan_label} — ${pending.months} month(s) — $${pending.price_per_month}/mo</p>
            <p><strong>Clinic Code:</strong> ${newClinicCode}</p>
            <p><strong>Admin Code:</strong> ${generatedAdminCode}</p>
            <p><strong>Nonprofit:</strong> ${pending.is_nonprofit ? `Yes — EIN: ${pending.nonprofit_ein}` : "No"}</p>
          `
        );
      }

      // Link user to company
      await supabase.from("company_users").upsert({
        company_id: companyId,
        user_id: user.id,
        role: pending.role,
        status: "active",
      });

      // Mark pending as complete
      await supabase.from("pending_onboarding")
        .update({ status: "complete" })
        .eq("user_id", user.id);

      setStatus("success");
      setMessage("Your clinic is ready!");

    } catch (err: any) {
      console.error("Onboarding complete error:", err);
      setStatus("error");
      setMessage(err.message || "Something went wrong.");
    }
  }

  async function copy(text: string, type: "clinic" | "admin") {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 font-medium">{message}</p>
          <p className="text-gray-400 text-sm">This takes just a few seconds...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center space-y-4">
          <div className="text-4xl">❌</div>
          <h1 className="text-xl font-bold text-gray-800">Setup Failed</h1>
          <p className="text-sm text-gray-500">{message}</p>
          <p className="text-xs text-gray-400">Your payment was processed. Please contact support@aba-ai-assistant.com and we will set up your account manually.</p>
          <a href="mailto:support@aba-ai-assistant.com"
            className="block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700">
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800">Clinic Created!</h1>
          <p className="text-gray-500 text-sm mt-1">Your payment was confirmed and your clinic is active.</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 text-center">
          ✅ 30-day free trial started. No charge until trial ends.
        </div>

        {clinicCode && (
          <div className="space-y-3">
            <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Clinic Code</p>
              <p className="text-xs text-blue-600 mb-2">Share with staff so they can join</p>
              <div className="flex items-center gap-3">
                <p className="text-xl font-black font-mono tracking-widest text-blue-800 flex-1">{clinicCode}</p>
                <button onClick={() => copy(clinicCode, "clinic")}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {copied === "clinic" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Admin Setup Code</p>
              <p className="text-xs text-purple-600 mb-2">Use this to set yourself up as Administrator — expires in 7 days</p>
              <div className="flex items-center gap-3">
                <p className="text-xl font-black font-mono tracking-widest text-purple-800 flex-1">{adminCode}</p>
                <button onClick={() => copy(adminCode, "admin")}
                  className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  {copied === "admin" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
              Save these codes! The admin code expires in 7 days and can only be used once.
            </div>
          </div>
        )}

        <button onClick={() => window.location.href = "/dashboard"}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700">
          Continue to Dashboard →
        </button>
      </div>
    </div>
  );
}
