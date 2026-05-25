"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Step = "profile" | "clinic" | "role" | "code" | "done";

const ROLES = [
  { value: "admin", label: "Administrator", desc: "Manage the clinic, billing, and team", requiresCode: true },
  { value: "supervisor", label: "Supervisor / BCBA", desc: "Oversee clinicians and approve exports", requiresCode: true },
  { value: "clinical_director", label: "Clinical Director", desc: "Lead clinical operations", requiresCode: true },
  { value: "clinician", label: "Clinician / RBT", desc: "Direct therapy and session notes", requiresCode: false },
  { value: "bt", label: "Behavior Technician (BT)", desc: "Direct therapy support", requiresCode: false },
  { value: "student_analyst", label: "Student Analyst", desc: "Supervised clinical work", requiresCode: false },
  { value: "parent", label: "Parent / Caregiver", desc: "View your child's progress", requiresCode: false },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [joinExisting, setJoinExisting] = useState(false);
  const [role, setRole] = useState("clinician");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeVerified, setCodeVerified] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  const selectedRole = ROLES.find((r) => r.value === role);

  function handleProfileStep() {
    if (!name.trim()) { setError("Please enter your name."); return; }
    setError(null);
    setStep("clinic");
  }

  function handleClinicStep() {
    if (!clinicName.trim()) { setError("Please enter your clinic name."); return; }
    setError(null);
    setStep("role");
  }

  function handleRoleStep() {
    setError(null);
    if (selectedRole?.requiresCode) {
      setStep("code");
    } else {
      handleComplete();
    }
  }

  async function handleVerifyCode() {
    if (!verificationCode.trim()) { setError("Please enter a verification code."); return; }
    setVerifyingCode(true);
    setError(null);

    const { data, error: codeError } = await supabase
      .from("role_codes")
      .select("*")
      .eq("code", verificationCode.trim().toUpperCase())
      .eq("role", role)
      .eq("used", false)
      .single();

    if (codeError || !data) {
      setError("Invalid or expired verification code. Contact your administrator.");
      setVerifyingCode(false);
      return;
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setError("This code has expired. Request a new one from your administrator.");
      setVerifyingCode(false);
      return;
    }

    setCodeVerified(true);
    setVerifyingCode(false);
    setError(null);
  }

  async function handleComplete() {
    setLoading(true);
    setError(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) { router.push("/login"); return; }

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: name,
          role,
          updated_at: new Date().toISOString(),
        });

      if (profileError) throw new Error(profileError.message);

      let companyId: string;

      if (joinExisting) {
        // Find existing company by name
        const { data: existingCompany, error: findError } = await supabase
          .from("companies")
          .select("id")
          .ilike("name", clinicName.trim())
          .single();

        if (findError || !existingCompany) {
          throw new Error("Clinic not found. Check the name or ask your admin to invite you.");
        }

        companyId = existingCompany.id;
      } else {
        // Create new company
        const slug = clinicName
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");

        const { data: company, error: companyError } = await supabase
          .from("companies")
          .insert({ name: clinicName.trim(), slug })
          .select()
          .single();

        if (companyError) throw new Error(companyError.message);
        companyId = company.id;
      }

      // Link user to company with role
      const { error: linkError } = await supabase
        .from("company_users")
        .upsert({
          company_id: companyId,
          user_id: user.id,
          role,
          status: "active",
        });

      if (linkError) throw new Error(linkError.message);

      // Mark verification code as used
      if (codeVerified && verificationCode) {
        await supabase
          .from("role_codes")
          .update({ used: true, used_by: user.id })
          .eq("code", verificationCode.trim().toUpperCase());
      }

      setStep("done");
      setTimeout(() => router.push("/dashboard"), 2000);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const stepLabels = ["Profile", "Clinic", "Role", ...(selectedRole?.requiresCode ? ["Verify"] : [])];
  const stepKeys: Step[] = ["profile", "clinic", "role", ...(selectedRole?.requiresCode ? ["code" as Step] : [])];
  const stepIndex = stepKeys.indexOf(step);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 w-full max-w-md">

        {/* PROGRESS */}
        {step !== "done" && (
          <div className="flex gap-2 mb-8">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${
                  i <= stepIndex ? "bg-blue-500" : "bg-gray-200"
                }`} />
                <p className={`text-xs mt-1 ${i <= stepIndex ? "text-blue-600" : "text-gray-400"}`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        {/* STEP 1 — PROFILE */}
        {step === "profile" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Welcome!</h1>
              <p className="text-gray-500 text-sm mt-1">Let's set up your profile.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleProfileStep()}
                placeholder="First and last name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              onClick={handleProfileStep}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* STEP 2 — CLINIC */}
        {step === "clinic" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Your Clinic</h1>
              <p className="text-gray-500 text-sm mt-1">Are you creating a new clinic or joining an existing one?</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setJoinExisting(false)}
                className={`border rounded-xl p-3 text-sm font-medium transition-all ${
                  !joinExisting ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"
                }`}
              >
                🏥 New Clinic
              </button>
              <button
                onClick={() => setJoinExisting(true)}
                className={`border rounded-xl p-3 text-sm font-medium transition-all ${
                  joinExisting ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-300"
                }`}
              >
                🔗 Join Existing
              </button>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                {joinExisting ? "Clinic Name (exact)" : "Clinic Name"}
              </label>
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleClinicStep()}
                placeholder={joinExisting ? "Enter your clinic's exact name" : "e.g. Sunshine ABA Therapy"}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {joinExisting && (
                <p className="text-xs text-gray-400 mt-1">
                  Must match exactly. Ask your admin if unsure.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep("profile")}
                className="flex-1 border rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleClinicStep}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — ROLE */}
        {step === "role" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Your Role</h1>
              <p className="text-gray-500 text-sm mt-1">What best describes your role?</p>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`w-full text-left border rounded-xl p-4 transition-all ${
                    role === r.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{r.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                    </div>
                    {r.requiresCode && (
                      <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full shrink-0 ml-2">
                        Code required
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep("clinic")}
                className="flex-1 border rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleRoleStep}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? "Setting up..." : selectedRole?.requiresCode ? "Next →" : "Complete Setup →"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — VERIFICATION CODE */}
        {step === "code" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Verify Your Role</h1>
              <p className="text-gray-500 text-sm mt-1">
                The <strong>{selectedRole?.label}</strong> role requires a verification code from your administrator.
              </p>
            </div>

            {codeVerified ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 text-center">
                ✅ Code verified! You're authorized as {selectedRole?.label}.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                    placeholder="e.g. BCBA-2024-XYZ"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono tracking-widest"
                    maxLength={20}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Ask your clinic administrator for this code.
                  </p>
                </div>
                <button
                  onClick={handleVerifyCode}
                  disabled={verifyingCode}
                  className="w-full border border-blue-500 text-blue-600 hover:bg-blue-50 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {verifyingCode ? "Verifying..." : "Verify Code"}
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setStep("role"); setCodeVerified(false); setVerificationCode(""); }}
                className="flex-1 border rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleComplete}
                disabled={!codeVerified || loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? "Setting up..." : "Complete Setup →"}
              </button>
            </div>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div className="text-center space-y-4 py-4">
            <div className="text-5xl">🎉</div>
            <h1 className="text-2xl font-bold text-gray-800">You're all set!</h1>
            <p className="text-gray-500 text-sm">Redirecting to your dashboard...</p>
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
}