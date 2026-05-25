"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

const emptyForm = {
  full_name: "",
  date_of_birth: "",
  guardian_name: "",
};

export default function NewClientPage() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { error: saveError } = await supabase
      .from("clients")
      .insert([{ ...form, created_by: user.id }]);

    if (saveError) {
      setError(saveError.message);
    } else {
      setSuccess(true);
      setForm(emptyForm);
    }

    setSaving(false);
  }

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
            <button
              className="underline"
              onClick={() => window.location.href = "/dashboard/clients"}
            >
              View all clients
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Client full name"
              className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Date of Birth</label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Guardian Name</label>
            <input
              type="text"
              value={form.guardian_name}
              onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
              placeholder="Guardian or caregiver name"
              className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <Button onClick={handleSave} loading={saving}>
            Add Client
          </Button>
        </div>
      </Section>
    </div>
  );
}