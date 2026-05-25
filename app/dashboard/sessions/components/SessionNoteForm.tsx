"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { telemetry } from "@/lib/telemetry";

type SessionNoteFormProps = {
  clientId?: string;
  userId: string;
  onSaved: () => void;
};

const emptyForm = {
  staff_member: "",
  client_name: "",
  date: "",
  location: "",
  duration: "",
  people_present: "",
  programs_targeted: "",
  behaviors_observed: "",
  interventions_used: "",
  client_response: "",
  next_session_plan: "",
};

export default function SessionNoteForm({
  clientId,
  userId,
  onSaved,
}: SessionNoteFormProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // =========================
  // SAVE SESSION
  // =========================
  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          client_id: clientId ?? null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to save session");
        return;
      }

      setForm(emptyForm);
      setAiResult(null);
      onSaved();
    } catch (err: any) {
      setError(err?.message || "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // GENERATE AI NOTE
  // =========================
  async function handleGenerateNote() {
    if (!form.client_name || !form.behaviors_observed) {
      setError("Client name and behaviors observed are required for AI generation.");
      return;
    }

    setGenerating(true);
    setError(null);
    setAiResult(null);

    try {
      const res = await telemetry.ai.note(
        {
          type: "note",
          client_name: form.client_name,
          behaviors_observed: form.behaviors_observed,
          interventions_used: form.interventions_used,
          client_response: form.client_response,
          programs_targeted: form.programs_targeted,
          date: form.date,
          staff_member: form.staff_member,
        },
        userId
      );

      if (res.error) {
        setError(res.error);
        return;
      }

      setAiResult("AI note queued successfully. Check back shortly for results.");
    } catch (err: any) {
      setError(err?.message || "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* FORM FIELDS */}
      {(Object.keys(form) as (keyof typeof form)[]).map((key) => (
        <input
          key={key}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={key.replaceAll("_", " ")}
          className="border rounded-lg p-3 text-sm"
        />
      ))}

      {/* ERROR */}
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {/* AI RESULT */}
      {aiResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          {aiResult}
        </div>
      )}

      {/* ACTIONS */}
      <div className="flex gap-3">
        <Button
          onClick={handleGenerateNote}
          loading={generating}
          variant="secondary"
          fullWidth
        >
          Generate AI Note
        </Button>

        <Button
          onClick={handleSave}
          loading={saving}
          fullWidth
        >
          Save Session
        </Button>
      </div>
    </div>
  );
}