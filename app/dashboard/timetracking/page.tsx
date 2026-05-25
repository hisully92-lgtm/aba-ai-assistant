"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type SessionError = {
  id: string;
  client_id: string | null;
  error_type: string;
  reason: string;
  estimated_start: string | null;
  estimated_end: string | null;
  session_date: string | null;
  created_at: string;
};

const ERROR_TYPES = [
  { value: "forgot_to_start", label: "Forgot to Start Timer" },
  { value: "forgot_to_end", label: "Forgot to End Timer" },
  { value: "app_failed", label: "App Failed / Technical Error" },
  { value: "incorrect_client", label: "Wrong Client Selected" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  client_id: "",
  error_type: "",
  reason: "",
  estimated_start: "",
  estimated_end: "",
  session_date: new Date().toISOString().split("T")[0],
};

export default function SessionErrorsPage() {
  const [errors, setErrors] = useState<SessionError[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: errData }, { data: clientData }] = await Promise.all([
      supabase
        .from("session_errors")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
    ]);

    setErrors(errData ?? []);
    setClients(clientData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.error_type || !form.reason) {
      setError("Error type and reason are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase
      .from("session_errors")
      .insert([{
        user_id: user.id,
        client_id: form.client_id || null,
        error_type: form.error_type,
        reason: form.reason,
        estimated_start: form.estimated_start || null,
        estimated_end: form.estimated_end || null,
        session_date: form.session_date || null,
      }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setErrors((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  function errorTypeLabel(type: string) {
    return ERROR_TYPES.find((e) => e.value === type)?.label ?? type;
  }

  function errorColor(type: string) {
    if (type === "forgot_to_start") return "bg-yellow-100 text-yellow-700";
    if (type === "forgot_to_end") return "bg-orange-100 text-orange-700";
    if (type === "app_failed") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  }

  const needsStartEnd = form.error_type === "forgot_to_start" ||
    form.error_type === "forgot_to_end" ||
    form.error_type === "app_failed";

  return (
    <div className="space-y-6">
      <PageHeader title="Session Error Log">
        <p className="text-gray-500 text-sm">Report timer and session errors for supervisor review.</p>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Report Error"}
        </Button>
      </PageHeader>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✓ Error reported successfully. Your supervisor will be notified.
        </div>
      )}

      {showForm && (
        <Section title="Report Session Error">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Error Type *</label>
              <select
                value={form.error_type}
                onChange={(e) => setForm({ ...form, error_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select error type...</option>
                {ERROR_TYPES.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
              <input
                type="date"
                value={form.session_date}
                onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {needsStartEnd && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Estimated Start Time</label>
                  <input
                    type="time"
                    value={form.estimated_start}
                    onChange={(e) => setForm({ ...form, estimated_start: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Estimated End Time</label>
                  <input
                    type="time"
                    value={form.estimated_end}
                    onChange={(e) => setForm({ ...form, estimated_end: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reason / Explanation *</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Explain what happened and why the error occurred..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Submit Report</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</Button>
          </div>
        </Section>
      )}

      <Section title={`Error Log (${errors.length})`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && errors.length === 0 && (
          <p className="text-gray-400 text-sm">No errors reported yet.</p>
        )}
        <div className="space-y-3">
          {errors.map((e) => (
            <div key={e.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${errorColor(e.error_type)}`}>
                      {errorTypeLabel(e.error_type)}
                    </span>
                    {e.client_id && (
                      <span className="text-xs text-gray-500">
                        {clientMap.get(e.client_id) ?? "Unknown client"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{e.reason}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    {e.session_date && <span>Date: {e.session_date}</span>}
                    {e.estimated_start && <span>Est. start: {e.estimated_start}</span>}
                    {e.estimated_end && <span>Est. end: {e.estimated_end}</span>}
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(e.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}