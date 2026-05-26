"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Intake = {
  id: string;
  client_id: string;
  primary_diagnosis: string;
  secondary_diagnosis: string;
  icd10_code: string;
  referring_physician: string;
  insurance_provider: string;
  insurance_id: string;
  authorization_number: string;
  authorized_hours: number;
  authorization_start: string;
  authorization_end: string;
  emergency_contact: string;
  emergency_phone: string;
  medications: string;
  allergies: string;
  school_name: string;
  teacher_name: string;
  intake_date: string;
  created_at: string;
};

const ICD10_CODES = [
  { code: "F84.0", desc: "Autistic Disorder" },
  { code: "F84.1", desc: "Atypical Autism" },
  { code: "F84.5", desc: "Asperger Syndrome" },
  { code: "F84.8", desc: "Other Pervasive Developmental Disorders" },
  { code: "F84.9", desc: "Pervasive Developmental Disorder, Unspecified" },
  { code: "F70", desc: "Mild Intellectual Disability" },
  { code: "F71", desc: "Moderate Intellectual Disability" },
  { code: "F72", desc: "Severe Intellectual Disability" },
  { code: "F73", desc: "Profound Intellectual Disability" },
  { code: "F80.1", desc: "Expressive Language Disorder" },
  { code: "F80.2", desc: "Mixed Receptive-Expressive Language Disorder" },
  { code: "F81.0", desc: "Specific Reading Disorder" },
  { code: "F90.0", desc: "ADHD, Predominantly Inattentive" },
  { code: "F90.1", desc: "ADHD, Predominantly Hyperactive-Impulsive" },
  { code: "F90.2", desc: "ADHD, Combined" },
  { code: "Q90.9", desc: "Down Syndrome, Unspecified" },
  { code: "G80.9", desc: "Cerebral Palsy, Unspecified" },
];

const DIAGNOSES = ["Autism Spectrum Disorder (ASD)", "Intellectual Disability", "ADHD", "Down Syndrome", "Cerebral Palsy", "Developmental Delay", "Language Disorder", "Anxiety Disorder", "Other"];
const INSURANCE_PROVIDERS = ["Medicaid", "Blue Cross Blue Shield", "Aetna", "United Healthcare", "Cigna", "Humana", "Tricare", "Kaiser Permanente", "Self-Pay", "Other"];

const emptyForm = {
  client_id: "",
  primary_diagnosis: "",
  secondary_diagnosis: "",
  icd10_code: "",
  referring_physician: "",
  insurance_provider: "",
  insurance_id: "",
  authorization_number: "",
  authorized_hours: 0,
  authorization_start: "",
  authorization_end: "",
  emergency_contact: "",
  emergency_phone: "",
  medications: "",
  allergies: "",
  school_name: "",
  teacher_name: "",
  intake_date: new Date().toISOString().split("T")[0],
};

export default function ClientIntakePage() {
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: intakeData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("client_intake").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setIntakes(intakeData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.client_id) { setError("Please select a client."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase
      .from("client_intake")
      .insert([{ ...form, created_by: user.id }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setIntakes((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  const filtered = filterClient ? intakes.filter((i) => i.client_id === filterClient) : intakes;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Client Intake">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Intake Form"}
        </Button>
      </PageHeader>

      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Intake form saved.</div>}

      {showForm && (
        <Section title="New Client Intake Form">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {/* CLIENT + DATES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Intake Date</label>
              <input type="date" value={form.intake_date} onChange={(e) => setForm({ ...form, intake_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* DIAGNOSIS */}
          <p className="text-sm font-semibold text-gray-700 mb-3">Diagnosis</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Primary Diagnosis</label>
              <select value={form.primary_diagnosis} onChange={(e) => setForm({ ...form, primary_diagnosis: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select diagnosis...</option>
                {DIAGNOSES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Secondary Diagnosis</label>
              <select value={form.secondary_diagnosis} onChange={(e) => setForm({ ...form, secondary_diagnosis: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">None</option>
                {DIAGNOSES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">ICD-10 Code</label>
              <select value={form.icd10_code} onChange={(e) => setForm({ ...form, icd10_code: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select ICD-10...</option>
                {ICD10_CODES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Referring Physician</label>
              <input type="text" value={form.referring_physician} onChange={(e) => setForm({ ...form, referring_physician: e.target.value })}
                placeholder="Dr. Name" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* INSURANCE */}
          <p className="text-sm font-semibold text-gray-700 mb-3">Insurance & Authorization</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Insurance Provider</label>
              <select value={form.insurance_provider} onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select provider...</option>
                {INSURANCE_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Insurance ID</label>
              <input type="text" value={form.insurance_id} onChange={(e) => setForm({ ...form, insurance_id: e.target.value })}
                placeholder="Member ID" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Authorization Number</label>
              <input type="text" value={form.authorization_number} onChange={(e) => setForm({ ...form, authorization_number: e.target.value })}
                placeholder="Auth #" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Authorized Hours</label>
              <input type="number" value={form.authorized_hours} onChange={(e) => setForm({ ...form, authorized_hours: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Auth Start</label>
              <input type="date" value={form.authorization_start} onChange={(e) => setForm({ ...form, authorization_start: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Auth End</label>
              <input type="date" value={form.authorization_end} onChange={(e) => setForm({ ...form, authorization_end: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* EMERGENCY + MEDICAL */}
          <p className="text-sm font-semibold text-gray-700 mb-3">Emergency & Medical</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Emergency Contact</label>
              <input type="text" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                placeholder="Name & relationship" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Emergency Phone</label>
              <input type="tel" value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })}
                placeholder="+1 (555) 000-0000" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Medications</label>
              <textarea value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })}
                placeholder="List current medications..." rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Allergies</label>
              <textarea value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                placeholder="Known allergies..." rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* SCHOOL */}
          <p className="text-sm font-semibold text-gray-700 mb-3">School Information</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">School Name</label>
              <input type="text" value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })}
                placeholder="School name" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Teacher Name</label>
              <input type="text" value={form.teacher_name} onChange={(e) => setForm({ ...form, teacher_name: e.target.value })}
                placeholder="Teacher name" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Intake Form</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && intakes.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} intakes</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Intake Forms">
          <p className="text-gray-400 text-sm">No intake forms yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((intake) => {
          const isExpanded = expandedId === intake.id;
          const authExpired = intake.authorization_end && new Date(intake.authorization_end) < new Date();
          return (
            <div key={intake.id} className={`border rounded-xl bg-white ${authExpired ? "border-red-200" : "border-gray-100"}`}>
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{clientMap.get(intake.client_id) ?? "Unknown"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Intake: {intake.intake_date}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {intake.primary_diagnosis && (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                          {intake.primary_diagnosis}
                        </span>
                      )}
                      {intake.icd10_code && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          ICD-10: {intake.icd10_code}
                        </span>
                      )}
                      {authExpired && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                          ⚠️ Auth Expired
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : intake.id)}
                    className="text-xs text-gray-400 hover:text-gray-600">
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {intake.insurance_provider && <p><span className="font-medium">Insurance:</span> {intake.insurance_provider}</p>}
                    {intake.insurance_id && <p><span className="font-medium">Member ID:</span> {intake.insurance_id}</p>}
                    {intake.authorization_number && <p><span className="font-medium">Auth #:</span> {intake.authorization_number}</p>}
                    {intake.authorized_hours > 0 && <p><span className="font-medium">Auth Hours:</span> {intake.authorized_hours}h</p>}
                    {intake.authorization_start && <p><span className="font-medium">Auth Start:</span> {intake.authorization_start}</p>}
                    {intake.authorization_end && <p><span className="font-medium text-red-600">Auth End:</span> {intake.authorization_end}</p>}
                    {intake.referring_physician && <p><span className="font-medium">Physician:</span> {intake.referring_physician}</p>}
                    {intake.emergency_contact && <p><span className="font-medium">Emergency:</span> {intake.emergency_contact} — {intake.emergency_phone}</p>}
                    {intake.medications && <p className="md:col-span-2"><span className="font-medium">Medications:</span> {intake.medications}</p>}
                    {intake.allergies && <p className="md:col-span-2"><span className="font-medium">Allergies:</span> {intake.allergies}</p>}
                    {intake.school_name && <p><span className="font-medium">School:</span> {intake.school_name}</p>}
                    {intake.teacher_name && <p><span className="font-medium">Teacher:</span> {intake.teacher_name}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}