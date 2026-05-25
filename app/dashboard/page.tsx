"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import BillingCard from "@/components/billing/BillingCard";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };

type SessionForm = {
  client_id: string;
  staff_member: string;
  date: string;
  behaviors_observed: string;
  interventions_used: string;
  client_response: string;
  programs_targeted: string;
  notes: string;
  status: string;
  soap_subjective: string;
  soap_objective: string;
  soap_assessment: string;
  soap_plan: string;
};

const BEHAVIORS_LIST = [
  "Aggression", "Self-Injurious Behavior", "Elopement", "Property Destruction",
  "Tantrum", "Non-Compliance", "Vocal Disruption", "Stereotypy", "No behaviors observed"
];

const INTERVENTIONS_LIST = [
  "Redirection", "Planned ignoring", "Differential reinforcement",
  "Response blocking", "NCR", "Token economy", "Visual supports",
  "First-Then board", "Praise/Reinforcement", "Prompting hierarchy"
];

const PROGRAMS_LIST = [
  "Mand Training", "Tact Training", "Imitation", "Matching",
  "Receptive ID", "Expressive ID", "LRFFC", "Intraverbal",
  "Social Skills", "Daily Living Skills", "Gross Motor", "Fine Motor"
];

const CLIENT_RESPONSES = [
  "Responded well", "Required multiple prompts", "Refused task",
  "Partial compliance", "Independent", "Needed full physical assistance"
];

const STAFF_ROLES = ["BCBA", "Clinical Director", "Student Analyst", "RBT", "BT", "Caregiver"];

const SOAP_FIELDS = [
  { key: "soap_subjective", label: "S — Subjective", placeholder: "Client/caregiver report, concerns, mood..." },
  { key: "soap_objective", label: "O — Objective", placeholder: "Measurable data, frequency, duration, observations..." },
  { key: "soap_assessment", label: "A — Assessment", placeholder: "Clinical interpretation, progress toward goals..." },
  { key: "soap_plan", label: "P — Plan", placeholder: "Next session plan, goals, modifications..." },
];

const emptyForm: SessionForm = {
  client_id: "",
  staff_member: "",
  date: new Date().toISOString().split("T")[0],
  behaviors_observed: "",
  interventions_used: "",
  client_response: "",
  programs_targeted: "",
  notes: "",
  status: "completed",
  soap_subjective: "",
  soap_objective: "",
  soap_assessment: "",
  soap_plan: "",
};

export default function DashboardHome() {
  const [stats, setStats] = useState({
    clients: 0, sessions: 0, behaviors: 0, programs: 0,
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [form, setForm] = useState<SessionForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSOAP, setShowSOAP] = useState(false);

  // Multi-select state
  const [selectedBehaviors, setSelectedBehaviors] = useState<string[]>([]);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);

  // Session staff state
  const [sessionStaff, setSessionStaff] = useState<{ name: string; role: string }[]>([]);
  const [staffInput, setStaffInput] = useState({ name: "", role: "RBT" });

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [clients, sessions, behaviors, programs, recentSessions, clientData] = await Promise.all([
      supabase.from("clients").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("sessions").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("behaviors").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("programs").select("*", { count: "exact", head: true }).eq("created_by", user.id),
      supabase.from("sessions")
        .select("id, client_id, date, status, behaviors_observed, programs_targeted, notes, soap_plan, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
    ]);

    setStats({
      clients: clients.count ?? 0,
      sessions: sessions.count ?? 0,
      behaviors: behaviors.count ?? 0,
      programs: programs.count ?? 0,
    });
    setRecentSessions(recentSessions.data ?? []);
    setClients(clientData.data ?? []);
  }

  function toggleItem(item: string, list: string[], setList: (l: string[]) => void) {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  function addStaff() {
    if (!staffInput.name.trim()) return;
    setSessionStaff((prev) => [...prev, { ...staffInput }]);
    setStaffInput({ name: "", role: "RBT" });
  }

  function removeStaff(index: number) {
    setSessionStaff((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setShowForm(false);
    setShowSOAP(false);
    setForm(emptyForm);
    setSelectedBehaviors([]);
    setSelectedInterventions([]);
    setSelectedPrograms([]);
    setSessionStaff([]);
    setStaffInput({ name: "", role: "RBT" });
  }

  async function handleSave() {
    if (!form.client_id) { setError("Please select a client."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const payload = {
      ...form,
      behaviors_observed: selectedBehaviors.join(", "),
      interventions_used: selectedInterventions.join(", "),
      programs_targeted: selectedPrograms.join(", "),
      staff_member: sessionStaff.length > 0
        ? sessionStaff.map((s) => `${s.name} (${s.role})`).join(", ")
        : form.staff_member,
      created_by: user.id,
    };

    const { error: saveError } = await supabase.from("sessions").insert([payload]);

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setSuccess(true);
    resetForm();
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
    init();
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Session Notes">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Session"}
        </Button>
      </PageHeader>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          ✓ Session note saved successfully.
        </div>
      )}

      {/* BILLING */}
      <BillingCard />

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Clients", value: stats.clients, href: "/dashboard/clients", color: "text-blue-600" },
          { label: "Sessions", value: stats.sessions, href: "/dashboard/history", color: "text-green-600" },
          { label: "Behaviors", value: stats.behaviors, href: "/dashboard/behaviors", color: "text-red-500" },
          { label: "Programs", value: stats.programs, href: "/dashboard/programs", color: "text-purple-600" },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => window.location.href = stat.href}
            className="p-4 border rounded-xl bg-white shadow hover:shadow-md transition-shadow text-left"
          >
            <p className="text-gray-500 text-sm">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </button>
        ))}
      </div>

      {/* SESSION FORM */}
      {showForm && (
        <Section title="New Session Note">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* CLIENT */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>

            {/* DATE */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {/* STATUS */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* CLIENT RESPONSE */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client Response</label>
              <select
                value={form.client_response}
                onChange={(e) => setForm({ ...form, client_response: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select response...</option>
                {CLIENT_RESPONSES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* SESSION STAFF */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Session Staff {sessionStaff.length > 0 && `(${sessionStaff.length})`}
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={staffInput.name}
                  onChange={(e) => setStaffInput({ ...staffInput, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addStaff()}
                  placeholder="Staff name"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <select
                  value={staffInput.role}
                  onChange={(e) => setStaffInput({ ...staffInput, role: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <Button variant="outline" onClick={addStaff}>Add</Button>
              </div>
              {sessionStaff.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sessionStaff.map((s, i) => (
                    <div key={i} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                      <span className="text-xs text-blue-800">{s.name} ({s.role})</span>
                      <button onClick={() => removeStaff(i)} className="text-blue-400 hover:text-blue-600 text-xs ml-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* BEHAVIORS OBSERVED */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Behaviors Observed {selectedBehaviors.length > 0 && `(${selectedBehaviors.length})`}
              </label>
              <div className="flex flex-wrap gap-2">
                {BEHAVIORS_LIST.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleItem(b, selectedBehaviors, setSelectedBehaviors)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      selectedBehaviors.includes(b)
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-red-300"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* INTERVENTIONS */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Interventions Used {selectedInterventions.length > 0 && `(${selectedInterventions.length})`}
              </label>
              <div className="flex flex-wrap gap-2">
                {INTERVENTIONS_LIST.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleItem(i, selectedInterventions, setSelectedInterventions)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      selectedInterventions.includes(i)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            {/* PROGRAMS TARGETED */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Programs Targeted {selectedPrograms.length > 0 && `(${selectedPrograms.length})`}
              </label>
              <div className="flex flex-wrap gap-2">
                {PROGRAMS_LIST.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleItem(p, selectedPrograms, setSelectedPrograms)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      selectedPrograms.includes(p)
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-purple-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* NOTES */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional session notes..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {/* SOAP NOTES TOGGLE */}
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => setShowSOAP(!showSOAP)}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <span>{showSOAP ? "▼" : "▶"}</span>
                SOAP Notes {showSOAP ? "(hide)" : "(optional)"}
              </button>
            </div>

            {/* SOAP NOTES */}
            {showSOAP && (
              <div className="md:col-span-2 space-y-3 border border-blue-100 rounded-xl p-4 bg-blue-50">
                <p className="text-xs font-semibold text-blue-700 mb-2">SOAP Note Format</p>
                {SOAP_FIELDS.map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-gray-600 mb-0.5 block">{label}</label>
                    <textarea
                      value={(form as any)[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value } as SessionForm)}
                      placeholder={placeholder}
                      rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Session Note</Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* RECENT SESSIONS */}
      {recentSessions.length > 0 && (
        <Section title="Recent Sessions">
          <div className="space-y-2">
            {recentSessions.map((s) => (
              <div
                key={s.id}
                className="border border-gray-100 rounded-xl p-4 bg-white flex justify-between items-start cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => window.location.href = `/dashboard/clients/${s.client_id}/case`}
              >
                <div>
                  <p className="font-medium text-gray-800">
                    {clientMap.get(s.client_id) ?? "Unknown client"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.date ?? new Date(s.created_at).toLocaleDateString()}
                  </p>
                  {s.behaviors_observed && (
                    <p className="text-xs text-gray-500 mt-1">Behaviors: {s.behaviors_observed}</p>
                  )}
                  {s.programs_targeted && (
                    <p className="text-xs text-gray-500">Programs: {s.programs_targeted}</p>
                  )}
                  {s.soap_plan && (
                    <p className="text-xs text-blue-500 mt-1">Plan: {s.soap_plan}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  s.status === "completed" ? "bg-green-100 text-green-700"
                  : s.status === "pending" ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-600"
                }`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Button variant="outline" onClick={() => window.location.href = "/dashboard/history"}>
              View All Sessions →
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}