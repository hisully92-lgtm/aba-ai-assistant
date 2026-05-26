"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type ParentDocument = {
  id: string;
  client_id: string;
  document_name: string;
  document_type: string;
  due_date: string | null;
  signed: boolean;
  signed_at: string | null;
  alert_days_before: number;
  notes: string | null;
  created_at: string;
};

const DOC_TYPES = [
  "Consent to Treat",
  "HIPAA Authorization",
  "Insurance Authorization",
  "Treatment Plan Signature",
  "Behavior Intervention Plan",
  "Annual Re-authorization",
  "Photo/Video Release",
  "Emergency Contact Form",
  "Intake Paperwork",
  "Telehealth Consent",
  "Progress Report Acknowledgment",
  "Other",
];

const emptyForm = {
  client_id: "",
  document_name: "",
  document_type: "",
  due_date: "",
  alert_days_before: 30,
  notes: "",
};

export default function ParentDocumentsPage() {
  const [documents, setDocuments] = useState<ParentDocument[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [filterSigned, setFilterSigned] = useState<"all" | "pending" | "signed">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: docData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("parent_documents").select("*").eq("created_by", user.id).order("due_date", { ascending: true }),
    ]);

    setClients(clientData ?? []);
    setDocuments(docData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.client_id || !form.document_name) {
      setError("Client and document name are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase.from("parent_documents").insert([{
      ...form,
      due_date: form.due_date || null,
      signed: false,
      created_by: user.id,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setDocuments((prev) => [...prev, data].sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }));
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function toggleSigned(id: string, signed: boolean) {
    await supabase.from("parent_documents").update({
      signed: !signed,
      signed_at: !signed ? new Date().toISOString() : null,
    }).eq("id", id);
    setDocuments((prev) => prev.map((d) => d.id === id ? { ...d, signed: !signed, signed_at: !signed ? new Date().toISOString() : null } : d));
  }

  async function handleDelete(id: string) {
    await supabase.from("parent_documents").delete().eq("id", id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function daysUntilDue(date: string | null) {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function dueColor(days: number | null, signed: boolean) {
    if (signed) return "bg-green-100 text-green-700";
    if (days === null) return "bg-gray-100 text-gray-500";
    if (days < 0) return "bg-red-100 text-red-700";
    if (days <= 7) return "bg-red-100 text-red-700";
    if (days <= 30) return "bg-orange-100 text-orange-700";
    return "bg-blue-100 text-blue-700";
  }

  function dueLabel(days: number | null, signed: boolean) {
    if (signed) return "✓ Signed";
    if (days === null) return "No due date";
    if (days < 0) return `⚠️ Overdue ${Math.abs(days)} days`;
    if (days === 0) return "⚠️ Due today";
    return `Due in ${days} days`;
  }

  let filtered = documents;
  if (filterClient) filtered = filtered.filter((d) => d.client_id === filterClient);
  if (filterSigned === "pending") filtered = filtered.filter((d) => !d.signed);
  if (filterSigned === "signed") filtered = filtered.filter((d) => d.signed);

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const pendingCount = documents.filter((d) => !d.signed).length;
  const overdueCount = documents.filter((d) => !d.signed && daysUntilDue(d.due_date) !== null && (daysUntilDue(d.due_date) ?? 1) < 0).length;
  const dueSoonCount = documents.filter((d) => {
    const days = daysUntilDue(d.due_date);
    return !d.signed && days !== null && days >= 0 && days <= 30;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Parent Portal Documents">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Document"}
        </Button>
      </PageHeader>

      {/* ALERTS */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700">🚨 {overdueCount} overdue document{overdueCount > 1 ? "s" : ""} — immediate action required.</p>
        </div>
      )}
      {dueSoonCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-bold text-orange-700">⚠️ {dueSoonCount} document{dueSoonCount > 1 ? "s" : ""} due within 30 days.</p>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-blue-600">{documents.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Documents</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">{documents.filter((d) => d.signed).length}</p>
          <p className="text-xs text-gray-500 mt-1">Signed</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-orange-500">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-1">Pending</p>
        </div>
      </div>

      {showForm && (
        <Section title="Add Document">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Document Type</label>
              <select value={form.document_type} onChange={(e) => setForm({ ...form, document_type: e.target.value, document_name: e.target.value !== "Other" ? e.target.value : form.document_name })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select type...</option>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Document Name *</label>
              <input type="text" value={form.document_name} onChange={(e) => setForm({ ...form, document_name: e.target.value })}
                placeholder="e.g. 2024 Consent to Treat"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Due Date</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Alert {form.alert_days_before} days before due</label>
              <input type="range" min={7} max={90} value={form.alert_days_before}
                onChange={(e) => setForm({ ...form, alert_days_before: parseInt(e.target.value) })}
                className="w-full" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Add Document</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTERS */}
      {!loading && documents.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
            {(["all", "pending", "signed"] as const).map((f) => (
              <button key={f} onClick={() => setFilterSigned(f)}
                className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${filterSigned === f ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
                {f}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-400">{filtered.length} documents</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Documents">
          <p className="text-gray-400 text-sm">No documents yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((doc) => {
          const days = daysUntilDue(doc.due_date);
          return (
            <div key={doc.id} className={`border rounded-xl p-4 bg-white ${doc.signed ? "border-green-200" : days !== null && days < 0 ? "border-red-200" : "border-gray-100"}`}>
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div className="flex items-start gap-3 flex-1">
                  <button onClick={() => toggleSigned(doc.id, doc.signed)}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${doc.signed ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                    {doc.signed && "✓"}
                  </button>
                  <div className="flex-1">
                    <p className={`font-semibold ${doc.signed ? "line-through text-gray-400" : "text-gray-800"}`}>
                      {doc.document_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {clientMap.get(doc.client_id) ?? "Unknown"}
                      {doc.document_type && ` · ${doc.document_type}`}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {doc.due_date && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${dueColor(days, doc.signed)}`}>
                          {dueLabel(days, doc.signed)}
                        </span>
                      )}
                    </div>
                    {doc.notes && <p className="text-xs text-gray-500 mt-1">{doc.notes}</p>}
                    {doc.signed && doc.signed_at && (
                      <p className="text-xs text-green-500 mt-1">Signed: {new Date(doc.signed_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDelete(doc.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}