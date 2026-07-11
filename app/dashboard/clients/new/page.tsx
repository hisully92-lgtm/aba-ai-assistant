"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import UpgradeRequiredModal from "@/components/billing/UpgradeRequiredModal";
import { getLimits } from "@/lib/planLimits";

const DIAGNOSES = [
  "Autism Spectrum Disorder (ASD)", "Intellectual Disability", "ADHD",
  "Down Syndrome", "Cerebral Palsy", "Developmental Delay",
  "Language Disorder", "Anxiety Disorder", "Other",
];

const emptyForm = {
  full_name: "", date_of_birth: "", guardian_name: "", diagnosis: "", goals: "",
};

export default function NewClientPage() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<{ id: string; name: string; plan: string } | null>(null);

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Client name is required."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!companyUser?.company_id) {
      setError("No company found. Please complete onboarding.");
      setSaving(false);
      return;
    }

    const { data: company } = await supabase
      .from("companies")
      .select("id, name, plan")
      .eq("id", companyUser.company_id)
      .single();

    const plan = company?.plan || "starter";
    const limits = getLimits(plan);

    const { count: currentClientCount } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyUser.company_id);

    if ((currentClientCount ?? 0) >= limits.clients) {
      setCompanyInfo({ id: companyUser.company_id, name: company?.name || "Your clinic", plan });
      setShowUpgradeModal(true);
      setSaving(false);
      return;
    }

    const { data, error: saveError } = await supabase
      .from("clients")
      .insert([{ ...form, created_by: user.id, company_id: companyUser.company_id }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    // Auto-assign based on role
    if (data) {
      if (["clinician", "rbt", "bt"].includes(companyUser.role)) {
        await supabase.from("assignments").insert([{
          client_id: data.id,
          rbt_id: user.id,
          supervisor_id: null,
          created_by: user.id,
        }]);
      } else if (["supervisor", "bcba"].includes(companyUser.role)) {
        await supabase.from("assignments").insert([{
          client_id: data.id,
          rbt_id: null,
          supervisor_id: user.id,
          created_by: user.id,
        }]);
      }
    }

    setSuccess(true);
    setForm(emptyForm);
    setSaving(false);
  }

  const inputClass = "w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

  return (
    <div className="space-y-6">
      <PageHeader title="Add Client">
        <p className="text-gray-500 text-sm">Register a new client or learner.</p>
      </PageHeader>

      <Section title="Client Details">
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-3">
            Client added successfully.{" "}
            <button type="button" className="underline"
              onClick={() => window.location.href = "/dashboard/clients"}>
              View all clients
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
            <input type="text" value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Client full name" className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Date of Birth</label>
            <input type="date" value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Guardian Name</label>
            <input type="text" value={form.guardian_name}
              onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
              placeholder="Parent or guardian" className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Diagnosis</label>
            <select value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              className={inputClass}>
              <option value="">Select diagnosis...</option>
              {DIAGNOSES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Goals</label>
            <textarea value={form.goals}
              onChange={(e) => setForm({ ...form, goals: e.target.value })}
              placeholder="Client's treatment goals..." rows={3}
              className={inputClass} />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={handleSave} loading={saving}>Save Client</Button>
          <Button variant="outline" onClick={() => window.location.href = "/dashboard/clients"}>
            Cancel
          </Button>
        </div>
      </Section>

      {showUpgradeModal && companyInfo && (
        <UpgradeRequiredModal
          resourceType="clients"
          currentPlan={companyInfo.plan}
          companyId={companyInfo.id}
          companyName={companyInfo.name}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}
