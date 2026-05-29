"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Step = "profile" | "clinic" | "role" | "code" | "done";

const ROLES = [
  {
    value: "admin",
    label: "Administrator",
    desc: "Manage the clinic, billing, and team",
    requiresCode: true,
  },
  {
    value: "supervisor",
    label: "Supervisor / BCBA",
    desc: "Oversee clinicians and approve exports",
    requiresCode: true,
  },
  {
    value: "clinical_director",
    label: "Clinical Director",
    desc: "Lead clinical operations",
    requiresCode: true,
  },
  {
    value: "clinician",
    label: "Clinician / RBT",
    desc: "Direct therapy and session notes",
    requiresCode: false,
  },
  {
    value: "bt",
    label: "Behavior Technician (BT)",
    desc: "Direct therapy support",
    requiresCode: false,
  },
  {
    value: "student_analyst",
    label: "Student Analyst",
    desc: "Supervised clinical work",
    requiresCode: false,
  },
  {
    value: "parent",
    label: "Parent / Caregiver",
    desc: "View your child's progress",
    requiresCode: false,
  },
];

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("profile");

  const [loading, setLoading] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  const [error, setError] = useState("");

  // Form State
  const [name, setName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [joinExisting, setJoinExisting] = useState(false);

  const [role, setRole] = useState("clinician");

  const [verificationCode, setVerificationCode] = useState("");
  const [codeVerified, setCodeVerified] = useState(false);

  const selectedRole = ROLES.find((r) => r.value === role);

  // =========================
  // STEP HANDLERS
  // =========================

  function handleProfileStep() {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setError("");
    setStep("clinic");
  }

  function handleClinicStep() {
    if (!clinicName.trim()) {
      setError("Please enter your clinic name.");
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

  // =========================
  // VERIFY ROLE CODE
  // =========================

  async function handleVerifyCode() {
    if (!verificationCode.trim()) {
      setError("Please enter a verification code.");
      return;
    }

    setVerifyingCode(true);
    setError("");

    // Try exact match first, then case-insensitive
    const { data, error: codeError } = await supabase
      .from("role_codes")
      .select("*")
      .ilike("code", verificationCode.trim())
      .eq("used", false)
      .single();

    if (codeError || !data) {
      setError(
        "Invalid or expired code. Ask your administrator for a valid code."
      );
      setVerifyingCode(false);
      return;
    }

    // Ensure role matches
    if (data.role !== role) {
      setError(
        `This code is for the ${data.role} role, not ${role}. Select the correct role or request a different code.`
      );
      setVerifyingCode(false);
      return;
    }

    // Check expiry
    if (
      data.expires_at &&
      new Date(data.expires_at) < new Date()
    ) {
      setError(
        "This verification code has expired. Contact your administrator for a new one."
      );
      setVerifyingCode(false);
      return;
    }

    setCodeVerified(true);
    setVerifyingCode(false);
    setError("");
  }

  // =========================
  // COMPLETE ONBOARDING
  // =========================

  async function handleComplete() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // =========================
      // UPDATE PROFILE
      // =========================

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: name.trim(),
          role,
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        throw new Error(profileError.message);
      }

      // =========================
      // CREATE / FIND COMPANY
      // =========================

      let companyId = "";

      if (joinExisting) {
        const { data: existingCompany, error: companyError } =
          await supabase
            .from("companies")
            .select("id")
            .ilike("name", clinicName.trim())
            .single();

        if (companyError || !existingCompany) {
          throw new Error(
            "Clinic not found. Verify the name or ask your administrator."
          );
        }

        companyId = existingCompany.id;
      } else {
        const slug = clinicName
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");

        const { data: company, error: createCompanyError } =
          await supabase
            .from("companies")
            .insert({
              name: clinicName.trim(),
              slug,
            })
            .select()
            .single();

        if (createCompanyError || !company) {
          throw new Error(
            createCompanyError?.message || "Failed to create clinic."
          );
        }

        companyId = company.id;
      }

      // =========================
      // LINK USER TO COMPANY
      // =========================

      const { error: linkError } = await supabase
        .from("company_users")
        .upsert({
          company_id: companyId,
          user_id: user.id,
          role,
          status: "active",
        });

      if (linkError) {
        throw new Error(linkError.message);
      }

      // =========================
      // MARK CODE AS USED
      // =========================

      if (codeVerified && verificationCode.trim()) {
        await supabase
          .from("role_codes")
          .update({
            used: true,
            used_by: user.id,
            used_at: new Date().toISOString(),
          })
          .ilike("code", verificationCode.trim());
      }

      setStep("done");

      setTimeout(() => { window.location.href = "/dashboard"; }, 1500);

    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );

      setLoading(false);
    }
  }

  // =========================
  // PROGRESS BAR
  // =========================

  const stepLabels = [
    "Profile",
    "Clinic",
    "Role",
    ...(selectedRole?.requiresCode ? ["Verify"] : []),
  ];

  const stepKeys: Step[] = selectedRole?.requiresCode
  ? ["profile", "clinic", "role", "code"]
  : ["profile", "clinic", "role"];

  const stepIndex = stepKeys.indexOf(step);

  // =========================
  // UI
  // =========================

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-lg p-8">

        {/* Progress */}
        {step !== "done" && (
          <div className="flex gap-2 mb-8">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    i <= stepIndex
                      ? "bg-blue-500"
                      : "bg-gray-200"
                  }`}
                />

                <p
                  className={`text-xs mt-1 ${
                    i <= stepIndex
                      ? "text-blue-600"
                      : "text-gray-400"
                  }`}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!!error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* PROFILE STEP */}
        {step === "profile" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Welcome!
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Let&apos;s set up your profile.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Full Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleProfileStep()
                }
                placeholder="First and last name"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <button
              onClick={handleProfileStep}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Continue →
            </button>
          </div>
        )}

        {/* CLINIC STEP */}
        {step === "clinic" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Your Clinic
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Create a new clinic or join an existing one.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setJoinExisting(false)}
                className={`rounded-xl border p-3 text-sm font-medium transition-all ${
                  !joinExisting
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-blue-300"
                }`}
              >
                🏥 New Clinic
              </button>

              <button
                onClick={() => setJoinExisting(true)}
                className={`rounded-xl border p-3 text-sm font-medium transition-all ${
                  joinExisting
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-blue-300"
                }`}
              >
                🔗 Join Existing
              </button>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {joinExisting
                  ? "Clinic Name (Exact)"
                  : "Clinic Name"}
              </label>

              <input
                type="text"
                value={clinicName}
                onChange={(e) =>
                  setClinicName(e.target.value)
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && handleClinicStep()
                }
                placeholder={
                  joinExisting
                    ? "Enter exact clinic name"
                    : "e.g. Sunshine ABA Therapy"
                }
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep("profile")}
                className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                ← Back
              </button>

              <button
                onClick={handleClinicStep}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ROLE STEP */}
        {step === "role" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Your Role
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Select your role.
              </p>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    role === r.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {r.label}
                      </p>

                      <p className="mt-0.5 text-xs text-gray-500">
                        {r.desc}
                      </p>
                    </div>

                    {r.requiresCode && (
                      <span className="ml-2 shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
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
                className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                ← Back
              </button>

              <button
                onClick={handleRoleStep}
                disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {loading
                  ? "Setting up..."
                  : selectedRole?.requiresCode
                  ? "Next →"
                  : "Complete Setup →"}
              </button>
            </div>
          </div>
        )}

        {/* CODE STEP */}
        {step === "code" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Verify Your Role
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                The{" "}
                <strong>{selectedRole?.label}</strong> role
                requires administrator approval.
              </p>
            </div>

            {codeVerified ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-sm text-green-700">
                ✅ Verification successful.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Verification Code
                  </label>

                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value)
                    }
                    placeholder="e.g. BCBA-2026-XYZ"
                    className="w-full rounded-lg border px-3 py-2 font-mono text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-300"
                    maxLength={30}
                  />
                </div>

                <button
                  onClick={handleVerifyCode}
                  disabled={verifyingCode}
                  className="w-full rounded-lg border border-blue-500 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
                >
                  {verifyingCode
                    ? "Verifying..."
                    : "Verify Code"}
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStep("role");
                  setCodeVerified(false);
                  setVerificationCode("");
                }}
                className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                ← Back
              </button>

              <button
                onClick={handleComplete}
                disabled={!codeVerified || loading}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {loading
                  ? "Setting up..."
                  : "Complete Setup →"}
              </button>
            </div>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div className="space-y-4 py-4 text-center">
            <div className="text-5xl">🎉</div>

            <h1 className="text-2xl font-bold text-gray-800">
              You're all set!
            </h1>

            <p className="text-sm text-gray-500">
              Redirecting to dashboard...
            </p>

            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}