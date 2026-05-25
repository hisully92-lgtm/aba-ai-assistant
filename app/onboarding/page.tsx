"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Step = "profile" | "clinic" | "role" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // STEP 1 — Profile
  const [name, setName] = useState("");

  // STEP 2 — Clinic
  const [clinicName, setClinicName] = useState("");

  // STEP 3 — Role
  const [role, setRole] = useState("clinician");

  async function handleProfileStep() {
    if (!name.trim()) { setError("Please enter your name."); return; }
    setError(null);
    setStep("clinic");
  }

  async function handleClinicStep() {
    if (!clinicName.trim()) { setError("Please enter your clinic name."); return; }
    setError(null);
    setStep("role");
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

      // Create company
      const slug = clinicName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({ name: clinicName, slug })
        .select()
        .single();

      if (companyError) throw new Error(companyError.message);

      // Link user to company
      await supabase.from("company_users").insert({
        company_id: company.id,
        user_id: user.id,
        status: "active",
      });

      setStep("done");
      setTimeout(() => router.push("/dashboard"), 2000);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const steps: Step[] = ["profile", "clinic", "role", "done"];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 w-full max-w-md">

        {/* PROGRESS */}
        <div className="flex gap-2 mb-8">
          {["Profile", "Clinic", "Role"].map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-blue-500" : "bg-gray-200"}`} />
              <p className={`text-xs mt-1 ${i <= stepIndex ? "text-blue-600" : "text-gray-400"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

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
                placeholder="First and last name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              onClick={handleProfileStep}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium"
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
              <p className="text-gray-500 text-sm mt-1">What's the name of your clinic or organization?</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Clinic Name</label>
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="e.g. Sunshine ABA Therapy"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("profile")}
                className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                onClick={handleClinicStep}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium"
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
            <div className="grid grid-cols-1 gap-3">
              {[
                { value: "clinician", label: "Clinician / RBT", desc: "Direct therapy and session notes" },
                { value: "supervisor", label: "Supervisor / BCBA", desc: "Oversee clinicians and approve exports" },
                { value: "admin", label: "Administrator", desc: "Manage the clinic and billing" },
              ].map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`text-left border rounded-xl p-4 transition-all ${
                    role === r.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <p className="font-medium text-gray-800">{r.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("clinic")}
                className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Setting up..." : "Complete Setup →"}
              </button>
            </div>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div className="text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <h1 className="text-2xl font-bold text-gray-800">You're all set!</h1>
            <p className="text-gray-500 text-sm">Redirecting to your dashboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}