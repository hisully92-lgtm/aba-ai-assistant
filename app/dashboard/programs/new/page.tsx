"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

const emptyForm = {
  program_name: "",
  goal: "",
  targets: "",
  prompt_level: "",
  mastery_criteria: "",
  trial_data: "",
  notes: "",
  staff_member: "",
};

export default function NewProgramPage() {
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
      .from("programs")
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
      <PageHeader title="Add Program">
        <p className="text-gray-500 text-sm">Create a new skill acquisition program.</p>
      </PageHeader>

      <Section title="Program Details">
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-3">
            Program saved successfully.
          </div>
        )}

        <div className="flex flex-col gap-4">
          {(Object.entries(form) as [keyof typeof emptyForm, string][]).map(([key, value]) => (
            <div key={key}>
              <label className="text-sm font-medium text-gray-700 mb-1 block capitalize">
                {key.replaceAll("_", " ")}
              </label>
              <textarea
                value={value}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={key.replaceAll("_", " ")}
                className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                rows={2}
              />
            </div>
          ))}
          <Button onClick={handleSave} loading={saving}>
            Save Program
          </Button>
        </div>
      </Section>
    </div>
  );
}