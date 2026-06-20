"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Step = "profile" | "clinic" | "hipaa" | "role" | "code" | "payment" | "admin_bootstrap" | "done";

const ROLES = [
  { value: "admin", label: "Administrator", desc: "Manage the clinic, billing, and team", requiresCode: true },
  { value: "supervisor", label: "Supervisor / BCBA", desc: "Oversee clinicians and approve exports", requiresCode: true },
  { value: "clinical_director", label: "Clinical Director", desc: "Lead clinical operations", requiresCode: true },
  { value: "clinician", label: "Clinician / RBT", desc: "Direct therapy and session notes", requiresCode: false },
  { value: "bt", label: "Behavior Technician (BT)", desc: "Direct therapy support", requiresCode: false },
  { value: "student_analyst", label: "Student Analyst", desc: "Supervised clinical work", requiresCode: false },
  { value: "parent", label: "Parent / Caregiver", desc: "View your child's progress", requiresCode: false },
];

const PLANS = [
  {
    id: "starter",
    label: "Starter",
    price: 129,
    desc: "1 clinician · Up to 10 clients · 1 location",
    features: ["Session notes", "Basic data collection", "Progress reports", "Email support"],
  },
  {
    id: "professional",
    label: "Professional",
    price: 249,
    desc: "Up to 5 clinicians · Unlimited clients · 2 locations",
    features: ["Everything in Starter", "AI session notes", "Insurance billing", "Priority support"],
  },
  {
    id: "growth",
    label: "Growth",
    price: 349,
    desc: "Up to 25 clinicians · Unlimited clients · 5 locations",
    features: ["Everything in Professional", "Advanced reporting", "Multi-location dashboard", "Onboarding support"],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: 499,
    desc: "Up to 75 clinicians · Unlimited clients · 15 locations",
    features: ["Everything in Growth", "EDI 837 claims", "QuickBooks integration", "Custom branding"],
  },
  {
    id: "clinic",
    label: "Clinic",
    price: 599,
    desc: "Unlimited clinicians · Unlimited clients · Unlimited locations",
    features: ["Everything in Enterprise", "White-label options", "API access", "Priority dedicated support"],
  },
];

const PLAN_TIERS: Record<string, Record<number, number>> = {
  starter:        { 1: 129, 3: 122, 6: 116, 9: 110, 12: 99 },
  professional:   { 1: 249, 3: 236, 6: 224, 9: 212, 12: 199 },
  growth:         { 1: 349, 3: 331, 6: 314, 9: 297, 12: 279 },
  enterprise:     { 1: 499, 3: 474, 6: 449, 9: 424, 12: 399 },
  clinic:         { 1: 599, 3: 569, 6: 539, 9: 509, 12: 499 },
};

const CONTRACT_OPTIONS = [
  { months: 1, label: "Monthly", savings: 0 },
  { months: 3, label: "3 Months", savings: null },
  { months: 6, label: "6 Months", savings: null },
  { months: 9, label: "9 Months", savings: null },
  { months: 12, label: "Annual", savings: null },
];

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

export default function OnboardingPage() {
  const [isNonprofit, setIsNonprofit] = useState(false);
  const [nonprofitEin, setNonprofitEin] = useState("");


  const router = useRouter();

  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicCode, setClinicCode] = useState("");
  const [joinExisting, setJoinExisting] = useState(false);
  const [role, setRole] = useState("clinician");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeVerified, setCodeVerified] = useState(false);
  const [hipaaAccepted, setHipaaAccepted] = useState(false);
  const [hipaaSignature, setHipaaSignature] = useState("");

  const [locations, setLocations] = useState([{ name: "", address: "", city: "", state: "", zip: "" }]);

  const [selectedPlan, setSelectedPlan] = useState("professional");
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");

  const [codePreference, setCodePreference] = useState<"profile" | "email" | "both" | "neither">("both");
  const [codeEmail, setCodeEmail] = useState("");

  const [generatedClinicCode, setGeneratedClinicCode] = useState("");
  const [generatedAdminCode, setGeneratedAdminCode] = useState("");
  const [copiedClinic, setCopiedClinic] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);

  const selectedRole = ROLES.find((r) => r.value === role);

  function handleProfileStep() {
    if (!name.trim()) { setError("Please enter your name."); return; }
    setError("");
    setStep("clinic");
  }

  function handleClinicStep() {
    if (!joinExisting && !clinicName.trim()) { setError("Please enter your clinic name."); return; }
    if (joinExisting && !clinicCode.trim()) { setError("Please enter your clinic code."); return; }
    setError("");
    setStep(joinExisting ? "role" : "hipaa");
  }

  function handleHipaaStep() {
    if (!hipaaAccepted || !hipaaSignature.trim()) {
      setError("Please accept the HIPAA BAA and enter your signature.");
      return;
    }
    setError("");
    setStep("role");
  }

  function handleRoleStep() {
    setError("");
    // New clinic founders skip code verification
    if (selectedRole?.requiresCode && joinExisting) { setStep("code"); return; }
    if (!joinExisting) { setStep("payment"); return; }
    handleComplete();
  }

  async function handleVerifyCode() {
    if (!verificationCode.trim()) { setError("Please enter a verification code."); return; }
    setVerifyingCode(true);
    setError("");

    const { data, error: codeError } = await supabase
      .from("role_codes")
      .select("*")
      .ilike("code", verificationCode.trim())
      .eq("used", false)
      .single();

    if (codeError || !data) {
      setError("Invalid or expired code. Ask your administrator for a valid code.");
      setVerifyingCode(false);
      return;
    }

    if (data.role !== role) {
      setError(`This code is for the ${data.role} role, not ${role}.`);
      setVerifyingCode(false);
      return;
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setError("This verification code has expired.");
      setVerifyingCode(false);
      return;
    }

    setCodeVerified(true);
    setVerifyingCode(false);
    setError("");
  }

  function addLocation() {
    setLocations([...locations, { name: "", address: "", city: "", state: "", zip: "" }]);
  }

  function updateLocation(index: number, field: string, value: string) {
    const updated = [...locations];
    (updated[index] as any)[field] = value;
    setLocations(updated);
  }

  function removeLocation(index: number) {
    setLocations(locations.filter((_, i) => i !== index));
  }

  async function handleCheckout() {
    if (!selectedPlan) return;
    setCheckoutLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const plan = PLANS.find(p => p.id === selectedPlan) ?? PLANS[1];
      const tier = PLAN_TIERS[selectedPlan]?.[selectedMonths] ?? plan.price;

      const res = await fetch("/api/square/onboarding-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          clinicName,
          planType: selectedPlan,
          planLabel: plan.label,
          months: selectedMonths,
          pricePerMonth: tier,
          role,
          hipaaSignature,
          locations,
          codePreference,
          codeEmail,
          isNonprofit,
          nonprofitEin,
          joinExisting,
          clinicCode,
          verificationCode,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError("Payment setup failed: " + result.error);
        setCheckoutLoading(false);
        return;
      }

      window.location.href = result.url;
    } catch (err: any) {
      setError(err.message);
      setCheckoutLoading(false);
    }
  }

  async function handleComplete() {
    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: name.trim(),
        role,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw new Error(profileError.message);

      if (hipaaSignature && !joinExisting) {
        await supabase.from("hipaa_agreements").insert([{
          user_id: user.id,
          clinic_name: clinicName.trim(),
          signatory_name: hipaaSignature.trim(),
          agreed_at: new Date().toISOString(),
        }]);
      }

      let companyId = "";
      let newClinicCode = "";

      if (joinExisting) {
        const { data: existingCompany, error: companyError } = await supabase
          .from("companies")
          .select("id, name")
          .ilike("clinic_code", clinicCode.trim())
          .maybeSingle();

        if (companyError) throw new Error(`Database error: ${companyError.message}`);
        if (!existingCompany) throw new Error("Clinic code not found. Double-check the code.");
        companyId = existingCompany.id;
      } else {
        const slug = clinicName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        const { data: company, error: createCompanyError } = await supabase
          .from("companies").insert({ name: clinicName.trim(), slug }).select().single();
        if (createCompanyError || !company) throw new Error(createCompanyError?.message || "Failed to create clinic.");
        companyId = company.id;

        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const rand = (n: number) => Array.from({length: n}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        newClinicCode = `${rand(4)}-${rand(4)}`;
        await supabase.from("companies").update({ clinic_code: newClinicCode }).eq("id", company.id);
        setGeneratedClinicCode(newClinicCode);

        for (const loc of locations) {
          if (loc.name.trim() || loc.address.trim()) {
            await supabase.from("locations").insert({
              company_id: companyId,
              name: loc.name.trim() || clinicName.trim(),
              address: loc.address.trim(),
              city: loc.city.trim(),
              state: loc.state.trim(),
              zip: loc.zip.trim(),
            });
          }
        }
      }

      const { error: linkError } = await supabase.from("company_users").upsert({
        company_id: companyId,
        user_id: user.id,
        role,
        status: codeVerified || !selectedRole?.requiresCode ? "active" : "pending",
      });
      if (linkError) throw new Error(linkError.message);

      if (codeVerified && verificationCode.trim()) {
        await supabase.from("role_codes").update({
          used: true,
          used_by: user.id,
          used_at: new Date().toISOString(),
        }).ilike("code", verificationCode.trim());
      }

      if (!joinExisting && newClinicCode) {
        const adminCode = generateAdminCode(newClinicCode);
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        await supabase.from("role_codes").insert([{
          code: adminCode,
          role: "admin",
          used: false,
          expires_at: expiryDate.toISOString().split("T")[0],
          company_id: companyId,
          created_by: user.id,
        }]);

        const trialStart = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);
        const plan = PLANS.find(p => p.id === selectedPlan) ?? PLANS[1];

        await supabase.from("subscription_contracts").insert([{
          user_id: user.id,
          company_id: companyId,
          plan_name: plan.label,
          plan_type: selectedPlan,
          contract_length_months: 1,
          price_per_month: plan.price,
          total_price: 0,
          discount_percent: 100,
          start_date: trialStart.toISOString().split("T")[0],
          end_date: trialEnd.toISOString().split("T")[0],
          auto_renew: true,
          renewal_reminder_days: 7,
          status: "trial",
          payment_method: "Card on file",
        }]);

        await supabase.from("companies").update({
          code_preference: codePreference,
          code_email: codeEmail.trim() || user.email,
        }).eq("id", companyId);

        if (codePreference === "email" || codePreference === "both") {
          const emailTo = codeEmail.trim() || user.email || "";
          await sendEmail(
            emailTo,
            "Your ABA AI Assistant Clinic Codes",
            `
              <h2>Welcome to ABA AI Assistant!</h2>
              <p>Here are your clinic codes. Keep them safe!</p>
              <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p><strong>Clinic Name:</strong> ${clinicName}</p>
                <p><strong>Clinic Code:</strong> <code style="font-size: 18px; font-weight: bold;">${newClinicCode}</code></p>
                <p><strong>Admin Setup Code:</strong> <code style="font-size: 18px; font-weight: bold;">${adminCode}</code></p>
                <p style="color: #dc2626; font-size: 12px;">Admin code expires in 7 days and can only be used once.</p>
              </div>
              <p>Share the Clinic Code with your staff so they can join your clinic.</p>
              <p>Use the Admin Setup Code to set yourself up as Administrator.</p>
              <p style="color: #6b7280; font-size: 11px;">
                Disclaimer: ABA AI Assistant stores your company codes as a backup in case you need assistance.
                This information is kept securely and only accessed when you request support.
              </p>
            `
          );
        }

        await sendEmail(
          "hisully92@gmail.com",
          `New Clinic Signed Up: ${clinicName}`,
          `
            <h2>New Clinic Registration</h2>
            <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Clinic Name:</strong> ${clinicName}</p>
              <p><strong>Admin Name:</strong> ${name}</p>
              <p><strong>Admin Email:</strong> ${user.email}</p>
              <p><strong>Clinic Code:</strong> ${newClinicCode}</p>
              <p><strong>Admin Code:</strong> ${adminCode}</p>
              <p><strong>Plan Selected:</strong> ${plan.label} ($${plan.price}/mo after trial)</p>
              <p><strong>Company ID:</strong> ${companyId}</p>
              <p><strong>Signed Up:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Locations:</strong> ${locations.filter(l => l.name || l.address).map(l => `${l.name} - ${l.address}, ${l.city}, ${l.state}`).join(" | ") || "Main location only"}</p>
              <p><strong>Code Preference:</strong> ${codePreference}</p>
              <p><strong>Nonprofit:</strong> ${isNonprofit ? `Yes — EIN: ${nonprofitEin}` : "No"}</p>
            </div>
          `
        );

        setGeneratedAdminCode(adminCode);
        setLoading(false);
        setStep("admin_bootstrap");
        return;
      }

      setStep("done");
      setTimeout(() => { window.location.href = "/dashboard"; }, 1500);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, type: "clinic" | "admin") {
    await navigator.clipboard.writeText(text);
    if (type === "clinic") { setCopiedClinic(true); setTimeout(() => setCopiedClinic(false), 2000); }
    else { setCopiedAdmin(true); setTimeout(() => setCopiedAdmin(false), 2000); }
  }

  const btnPrimary = "w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 cursor-pointer select-none";
  const btnSecondary = "flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 cursor-pointer select-none";
  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white border border-gray-100 rounded-2xl shadow-lg p-8">

        {step !== "done" && step !== "admin_bootstrap" && (
          <div className="flex gap-1 mb-8 overflow-x-auto">
            {["Profile", "Clinic", ...(!joinExisting ? ["HIPAA", "Plan"] : []), "Role", ...(selectedRole?.requiresCode ? ["Verify"] : [])].map((label, i) => (
              <div key={label} className="flex-1 min-w-[40px]">
                <div className={`h-1.5 rounded-full transition-colors ${i <= ["profile","clinic","hipaa","role","code","payment"].indexOf(step) ? "bg-blue-500" : "bg-gray-200"}`} />
                <p className="text-xs mt-1 text-gray-400 truncate">{label}</p>
              </div>
            ))}
          </div>
        )}

        {!!error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        {/* PROFILE */}
        {step === "profile" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Welcome!</h1>
              <p className="mt-1 text-sm text-gray-500">Let&apos;s set up your profile.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleProfileStep()}
                placeholder="First and last name" className={inputClass} />
            </div>
            <button type="button" onClick={handleProfileStep} className={btnPrimary}>
              Continue →
            </button>
          </div>
        )}

        {/* CLINIC */}
        {step === "clinic" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Your Clinic</h1>
              <p className="mt-1 text-sm text-gray-500">Create a new clinic or join an existing one.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setJoinExisting(false)}
                className={`rounded-xl border p-3 text-sm font-medium transition-all cursor-pointer ${!joinExisting ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                🏥 New Clinic
              </button>
              <button type="button" onClick={() => setJoinExisting(true)}
                className={`rounded-xl border p-3 text-sm font-medium transition-all cursor-pointer ${joinExisting ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                🔗 Join Existing
              </button>
            </div>

            {!joinExisting ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Clinic Name</label>
                  <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)}
                    placeholder="e.g. Sunshine ABA Therapy" className={inputClass} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Locations</label>
                    <button type="button" onClick={addLocation}
                      className="text-xs text-blue-600 hover:underline">+ Add Location</button>
                  </div>
                  {locations.map((loc, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-3 mb-2 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-medium text-gray-600">Location {i + 1}</p>
                        {i > 0 && (
                          <button type="button" onClick={() => removeLocation(i)}
                            className="text-xs text-red-400 hover:text-red-600">Remove</button>
                        )}
                      </div>
                      <input type="text" placeholder="Location name (e.g. Main Office)"
                        value={loc.name} onChange={e => updateLocation(i, "name", e.target.value)}
                        className={inputClass} />
                      <input type="text" placeholder="Street address"
                        value={loc.address} onChange={e => updateLocation(i, "address", e.target.value)}
                        className={inputClass} />
                      <div className="grid grid-cols-3 gap-2">
                        <input type="text" placeholder="City"
                          value={loc.city} onChange={e => updateLocation(i, "city", e.target.value)}
                          className={inputClass} />
                        <input type="text" placeholder="State"
                          value={loc.state} onChange={e => updateLocation(i, "state", e.target.value)}
                          className={inputClass} />
                        <input type="text" placeholder="ZIP"
                          value={loc.zip} onChange={e => updateLocation(i, "zip", e.target.value)}
                          className={inputClass} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Clinic Code</label>
                <input type="text" value={clinicCode} onChange={e => setClinicCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCD-1234"
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <p className="text-xs text-gray-400 mt-1">Ask your clinic administrator for this code.</p>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => setStep("profile")} className={btnSecondary}>← Back</button>
              <button type="button" onClick={handleClinicStep}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 cursor-pointer">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* HIPAA */}
        {step === "hipaa" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">HIPAA Agreement</h1>
              <p className="mt-1 text-sm text-gray-500">
                Before using ABA AI to store protected health information, your clinic must sign a Business Associate Agreement (BAA).
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-2 max-h-48 overflow-y-auto">
              <p className="font-bold text-gray-800">Business Associate Agreement (BAA)</p>
              <p>This Business Associate Agreement is entered into between {clinicName} (&ldquo;Covered Entity&rdquo;) and ABA AI (&ldquo;Business Associate&rdquo;) pursuant to HIPAA and the HITECH Act.</p>
              <p><strong>1. Permitted Uses.</strong> Business Associate may use PHI only as necessary to provide services to Covered Entity.</p>
              <p><strong>2. Safeguards.</strong> Business Associate agrees to implement appropriate administrative, physical, and technical safeguards to protect PHI.</p>
              <p><strong>3. Breach Notification.</strong> Business Associate will notify Covered Entity of any breach of unsecured PHI within 60 days of discovery.</p>
              <p><strong>4. Subcontractors.</strong> Business Associate will ensure any subcontractors agree to the same restrictions and conditions.</p>
              <p><strong>5. Termination.</strong> Either party may terminate this agreement if the other party materially breaches any term.</p>
              <p><strong>6. Return of PHI.</strong> Upon termination, Business Associate will return or destroy all PHI received from Covered Entity.</p>
              <p>By signing below, both parties agree to the terms of this Business Associate Agreement in accordance with HIPAA regulations (45 CFR Parts 160 and 164).</p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={hipaaAccepted} onChange={e => setHipaaAccepted(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">
                I have read and agree to the HIPAA BAA on behalf of <strong>{clinicName}</strong>. I confirm I am authorized to sign.
              </span>
            </label>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Full name as signature *</label>
              <input type="text" value={hipaaSignature} onChange={e => setHipaaSignature(e.target.value)}
                placeholder="Your full legal name" className={inputClass} />
              <p className="text-xs text-gray-400 mt-1">Date: {new Date().toLocaleDateString()} · Legally binding electronic signature.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep("clinic")} className={btnSecondary}>← Back</button>
              <button type="button" onClick={handleHipaaStep} disabled={!hipaaAccepted || !hipaaSignature.trim()}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                Accept and Continue →
              </button>
            </div>
          </div>
        )}

        {/* PAYMENT */}
        {step === "payment" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Choose Your Plan</h1>
              <p className="mt-1 text-sm text-gray-500">First month free — no charge until your trial ends.</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 text-center">
              🎉 <strong>30-day free trial</strong> — your card will not be charged until the trial ends.
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {PLANS.map(plan => {
                const price = PLAN_TIERS[plan.id]?.[selectedMonths] ?? plan.price;
                const savings = selectedMonths > 1 ? (plan.price - price) * selectedMonths : 0;
                return (
                  <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${selectedPlan === plan.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-800">{plan.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{plan.desc}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-xl font-bold text-blue-600">\${price}</p>
                        <p className="text-xs text-gray-400">/mo</p>
                        {savings > 0 && <p className="text-xs text-green-600">Save \${savings}</p>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border border-gray-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Contract Length</p>
              <div className="grid grid-cols-5 gap-1">
                {CONTRACT_OPTIONS.map(opt => (
                  <button key={opt.months} type="button"
                    onClick={() => setSelectedMonths(opt.months)}
                    className={`rounded-lg border py-2 text-xs font-medium transition-all ${selectedMonths === opt.months ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {selectedMonths > 1 && (
                <p className="text-xs text-gray-400">
                  Billed as \${(PLAN_TIERS[selectedPlan]?.[selectedMonths] ?? 0) * selectedMonths} every {selectedMonths} months
                </p>
              )}
            </div>

            <div className="border border-gray-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Company Code Delivery</p>
              <p className="text-xs text-gray-400">Choose how you want to receive your clinic and admin codes.</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "profile", label: "Save to Profile" },
                  { value: "email", label: "Email Me" },
                  { value: "both", label: "Both" },
                  { value: "neither", label: "Neither" },
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setCodePreference(opt.value as any)}
                    className={`rounded-lg border p-2 text-xs font-medium transition-all ${codePreference === opt.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {(codePreference === "email" || codePreference === "both") && (
                <input type="email" placeholder="Email address for codes"
                  value={codeEmail} onChange={e => setCodeEmail(e.target.value)}
                  className={inputClass} />
              )}
            </div>

            <div className="border border-gray-200 rounded-xl p-4 bg-green-50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Nonprofit Organization?</p>
                  <p className="text-xs text-gray-500">501(c)(3) organizations receive 20% off.</p>
                </div>
                <button type="button" onClick={() => setIsNonprofit(p => !p)}
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${isNonprofit ? "bg-green-500" : "bg-gray-300"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isNonprofit ? "left-7" : "left-1"}`} />
                </button>
              </div>
              {isNonprofit && (
                <input type="text" placeholder="Organization EIN (e.g. 12-3456789)"
                  value={nonprofitEin} onChange={e => setNonprofitEin(e.target.value)}
                  className={inputClass} />
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">Secure Payment via Square</p>
              <p className="text-xs">You will be redirected to Square to securely enter your payment details. Your card will not be charged until after your 30-day free trial.</p>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setStep("role")} className={btnSecondary}>← Back</button>
              <button type="button" onClick={handleCheckout} disabled={checkoutLoading}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                {checkoutLoading ? "Redirecting to Square..." : "Proceed to Payment →"}
              </button>
            </div>
          </div>
        )}

        {/* ROLE */}
        {step === "role" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Your Role</h1>
              <p className="mt-1 text-sm text-gray-500">Select your role.</p>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {ROLES.map(r => (
                <button type="button" key={r.value} onClick={() => setRole(r.value)}
                  className={`w-full rounded-xl border p-4 text-left transition-all cursor-pointer ${role === r.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.label}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{r.desc}</p>
                    </div>
                    {r.requiresCode && joinExisting && (
                      <span className="ml-2 shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Code required</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(joinExisting ? "clinic" : "hipaa")} className={btnSecondary}>← Back</button>
              <button type="button" onClick={handleRoleStep} disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                {loading ? "Setting up..." : selectedRole?.requiresCode ? "Next →" : "Complete Setup →"}
              </button>
            </div>
          </div>
        )}

        {/* CODE */}
        {step === "code" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Verify Your Role</h1>
              <p className="mt-1 text-sm text-gray-500">
                The <strong>{selectedRole?.label}</strong> role requires a verification code from your administrator.
              </p>
            </div>
            {codeVerified ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-sm text-green-700">
                ✓ Verification successful.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Verification Code</label>
                  <input type="text" value={verificationCode} onChange={e => setVerificationCode(e.target.value)}
                    placeholder="e.g. ABCD-ADMI-2026-XY9Z"
                    className="w-full rounded-lg border px-3 py-2 font-mono text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-300"
                    maxLength={30} />
                </div>
                <button type="button" onClick={handleVerifyCode} disabled={verifyingCode}
                  className="w-full rounded-lg border border-blue-500 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 cursor-pointer">
                  {verifyingCode ? "Verifying..." : "Verify Code"}
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setStep("role"); setCodeVerified(false); setVerificationCode(""); }} className={btnSecondary}>← Back</button>
              <button type="button" onClick={() => { if (!joinExisting) { setStep("payment"); } else { handleComplete(); } }}
                disabled={!codeVerified || loading}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                {loading ? "Setting up..." : "Next →"}
              </button>
            </div>
          </div>
        )}

        {/* ADMIN BOOTSTRAP */}
        {step === "admin_bootstrap" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h1 className="text-2xl font-bold text-gray-800">Clinic Created!</h1>
              <p className="mt-1 text-sm text-gray-500">
                Save these codes — you will need them to set up your admin account and invite team members.
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 text-center">
              ✅ Your <strong>30-day free trial</strong> has started. No charge until the trial ends.
            </div>
            <div className="space-y-3">
              <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Your Clinic Code</p>
                <p className="text-xs text-blue-600 mb-2">Share this with staff so they can join your clinic</p>
                <div className="flex items-center gap-3">
                  <p className="text-xl font-black font-mono tracking-widest text-blue-800 flex-1">{generatedClinicCode}</p>
                  <button type="button" onClick={() => copyToClipboard(generatedClinicCode, "clinic")}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                    {copiedClinic ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Your Admin Setup Code</p>
                <p className="text-xs text-purple-600 mb-2">Use this to set yourself up as Administrator — expires in 7 days</p>
                <div className="flex items-center gap-3">
                  <p className="text-xl font-black font-mono tracking-widest text-purple-800 flex-1">{generatedAdminCode}</p>
                  <button type="button" onClick={() => copyToClipboard(generatedAdminCode, "admin")}
                    className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer">
                    {copiedAdmin ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
              Save these codes somewhere safe. The admin code expires in 7 days and can only be used once.
              {(codePreference === "email" || codePreference === "both") && (
                <p className="mt-1">📧 Codes also sent to {codeEmail || "your email"}.</p>
              )}
            </div>
            <button type="button"
              onClick={() => { setStep("done"); setTimeout(() => { window.location.href = "/dashboard"; }, 1500); }}
              className={btnPrimary}>
              Continue to Dashboard →
            </button>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div className="space-y-4 py-4 text-center">
            <div className="text-5xl">🎉</div>
            <h1 className="text-2xl font-bold text-gray-800">You&apos;re all set!</h1>
            <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}












