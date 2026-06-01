"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Step = "profile" | "clinic" | "hipaa" | "role" | "code" | "admin_bootstrap" | "done";

const ROLES = [
  { value: "admin", label: "Administrator", desc: "Manage the clinic, billing, and team", requiresCode: true },
  { value: "supervisor", label: "Supervisor / BCBA", desc: "Oversee clinicians and approve exports", requiresCode: true },
  { value: "clinical_director", label: "Clinical Director", desc: "Lead clinical operations", requiresCode: true },
  { value: "clinician", label: "Clinician / RBT", desc: "Direct therapy and session notes", requiresCode: false },
  { value: "bt", label: "Behavior Technician (BT)", desc: "Direct therapy support", requiresCode: false },
  { value: "student_analyst", label: "Student Analyst", desc: "Supervised clinical work", requiresCode: false },
  { value: "parent", label: "Parent / Caregiver", desc: "View your child's progress", requiresCode: false },
];

function generateAdminCode(clinicCode: string): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const year = new Date().getFullYear();
  return `${clinicCode}-ADMI-${year}-${random}`;
}

export default function OnboardingPage() {
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

  // Bootstrap state
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
    if (joinExisting) {
      setStep("role");
    } else {
      setStep("hipaa");
    }
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
    if (selectedRole?.requiresCode) {
      setStep("code");
      return;
    }
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
      setError(`This code is for the ${data.role} role, not ${role}. Select the correct role or request a different code.`);
      setVerifyingCode(false);
      return;
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setError("This verification code has expired. Contact your administrator for a new one.");
      setVerifyingCode(false);
      return;
    }

    setCodeVerified(true);
    setVerifyingCode(false);
    setError("");
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

        if (companyError) {
          throw new Error(`Database error: ${companyError.message}`);
        }
        if (!existingCompany) {
          throw new Error("Clinic code not found. Double-check the code — codes look like XXXX-XXXX.");
        }
        companyId = existingCompany.id;
      } else {
        const slug = clinicName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        const { data: company, error: createCompanyError } = await supabase
          .from("companies").insert({ name: clinicName.trim(), slug }).select().single();
        if (createCompanyError || !company) throw new Error(createCompanyError?.message || "Failed to create clinic.");
        companyId = company.id;

        // Generate clinic code
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I confusion
        const rand = (n: number) => Array.from({length: n}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        SnewClinicCode = `${rand(4)}-${rand(4)}`;
        await supabase.from("companies").update({ clinic_code: newClinicCode }).eq("id", company.id);
        setGeneratedClinicCode(newClinicCode);
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

      // If new clinic founder — generate bootstrap admin code
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
    if (type === "clinic") {
      setCopiedClinic(true);
      setTimeout(() => setCopiedClinic(false), 2000);
    } else {
      setCopiedAdmin(true);
      setTimeout(() => setCopiedAdmin(false), 2000);
    }
  }

  const stepLabels = ["Profile", "Clinic", ...(!joinExisting ? ["HIPAA"] : []), "Role", ...(selectedRole?.requiresCode ? ["Verify"] : [])];
  const stepKeys: Step[] = selectedRole?.requiresCode
    ? (joinExisting ? ["profile", "clinic", "role", "code"] : ["profile", "clinic", "hipaa", "role", "code"])
    : (joinExisting ? ["profile", "clinic", "role"] : ["profile", "clinic", "hipaa", "role"]);
  const stepIndex = stepKeys.indexOf(step);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-lg p-8">

        {step !== "done" && step !== "admin_bootstrap" && (
          <div className="flex gap-2 mb-8">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${i <= stepIndex ? "bg-blue-500" : "bg-gray-200"}`} />
                <p className={`text-xs mt-1 ${i <= stepIndex ? "text-blue-600" : "text-gray-400"}`}>{label}</p>
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
                placeholder="First and last name"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <button onClick={handleProfileStep}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
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
              <button onClick={() => setJoinExisting(false)}
                className={`rounded-xl border p-3 text-sm font-medium transition-all ${!joinExisting ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                🏥 New Clinic
              </button>
              <button onClick={() => setJoinExisting(true)}
                className={`rounded-xl border p-3 text-sm font-medium transition-all ${joinExisting ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                🔗 Join Existing
              </button>
            </div>

            {!joinExisting ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Clinic Name</label>
                <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleClinicStep()}
                  placeholder="e.g. Sunshine ABA Therapy"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Clinic Code</label>
                <input type="text" value={clinicCode} onChange={e => setClinicCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && handleClinicStep()}
                  placeholder="e.g. ABCD-1234"
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <p className="text-xs text-gray-400 mt-1">Ask your clinic administrator for this code.</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep("profile")}
                className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                ← Back
              </button>
              <button onClick={handleClinicStep}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
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
                placeholder="Your full legal name"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <p className="text-xs text-gray-400 mt-1">Date: {new Date().toLocaleDateString()} · Legally binding electronic signature.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep("clinic")}
                className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                ← Back
              </button>
              <button onClick={handleHipaaStep} disabled={!hipaaAccepted || !hipaaSignature.trim()}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
                Accept and Continue →
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
                <button key={r.value} onClick={() => setRole(r.value)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${role === r.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.label}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{r.desc}</p>
                    </div>
                    {r.requiresCode && (
                      <span className="ml-2 shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Code required</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(joinExisting ? "clinic" : "hipaa")}
                className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                ← Back
              </button>
              <button onClick={handleRoleStep} disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
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
                Verification successful.
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
                <button onClick={handleVerifyCode} disabled={verifyingCode}
                  className="w-full rounded-lg border border-blue-500 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50">
                  {verifyingCode ? "Verifying..." : "Verify Code"}
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setStep("role"); setCodeVerified(false); setVerificationCode(""); }}
                className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                ← Back
              </button>
              <button onClick={handleComplete} disabled={!codeVerified || loading}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
                {loading ? "Setting up..." : "Complete Setup →"}
              </button>
            </div>
          </div>
        )}

        {/* ADMIN BOOTSTRAP — shown to new clinic founders */}
        {step === "admin_bootstrap" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h1 className="text-2xl font-bold text-gray-800">Clinic Created!</h1>
              <p className="mt-1 text-sm text-gray-500">
                Save these codes — you will need them to set up your admin account and invite team members.
              </p>
            </div>

            <div className="space-y-3">
              {/* CLINIC CODE */}
              <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Your Clinic Code</p>
                <p className="text-xs text-blue-600 mb-2">Share this with staff so they can join your clinic</p>
                <div className="flex items-center gap-3">
                  <p className="text-xl font-black font-mono tracking-widest text-blue-800 flex-1">{generatedClinicCode}</p>
                  <button onClick={() => copyToClipboard(generatedClinicCode, "clinic")}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    {copiedClinic ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* ADMIN CODE */}
              <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Your Admin Setup Code</p>
                <p className="text-xs text-purple-600 mb-2">Use this code to set yourself up as Administrator — expires in 7 days</p>
                <div className="flex items-center gap-3">
                  <p className="text-xl font-black font-mono tracking-widest text-purple-800 flex-1">{generatedAdminCode}</p>
                  <button onClick={() => copyToClipboard(generatedAdminCode, "admin")}
                    className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    {copiedAdmin ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
              Save these codes somewhere safe. The admin code expires in 7 days and can only be used once. You can generate more codes from the Admin panel after setup.
            </div>

            <button
              onClick={() => { setStep("done"); setTimeout(() => { window.location.href = "/dashboard"; }, 1500); }}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
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