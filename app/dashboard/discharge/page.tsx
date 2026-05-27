"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import jsPDF from "jspdf";

type Client = { id: string; full_name: string; diagnosis: string | null };
type DischargePlan = {
  id: string;
  client_id: string;
  discharge_date: string | null;
  reason: string;
  goals_mastered: string[];
  goals_in_progress: string[];
  maintenance_plan: string;
  follow_up_recommendations: string;
  caregiver_training_completed: boolean;
  status: string;
  created_at: string;
};

const DISCHARGE_REASONS = [
  "Goals mastered — natural discharge",
  "Family request",
  "Insurance exhausted",
  "Moved out of service area",
  "Transitioned to school services",
  "Aging out of services",
  "Fading to maintenance",
  "Other",
];

const DISCHARGE_STATUSES = ["planning", "in_progress", "discharged", "on_hold"];

const emptyForm = {
  client_id: "",
  discharge_date: "",
  reason: "",
  goals_mastered: [] as string[],
  goals_in_progress: [] as string[],
  maintenance_plan: "",
  follow_up_recommendations: "",
  caregiver_training_completed: false,
  status: "planning",
};

export default function DischargePage() {
  const [plans, setPlans] = useState<DischargePlan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newMastered, setNewMastered] = useState("");
  const [newInProgress, setNewInProgress] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: planData }] = await Promise.all([
      supabase.from("clients").select("id, full_name, diagnosis"),
      supabase.from("discharge_plans").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setPlans((planData ?? []).map((p: any) => ({
      ...p,
      goals_mastered: Array.isArray(p.goals_mastered) ? p.goals_mastered : JSON.parse(p.goals_mastered || "[]"),
      goals_in_progress: Array.isArray(p.goals_in_progress) ? p.goals_in_progress : JSON.parse(p.goals_in_progress || "[]"),
    })));
    setLoading(false);
  }

  async function handleSave() {
    if (!form.client_id || !form.reason) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("discharge_plans").insert([{
      ...form,
      discharge_date: form.discharge_date || null,
      goals_mastered: JSON.stringify(form.goals_mastered),
      goals_in_progress: JSON.stringify(form.goals_in_progress),
      created_by: user.id,
    }]).select().single();

    if (data) setPlans((prev) => [{ ...data, goals_mastered: form.goals_mastered, goals_in_progress: form.goals_in_progress }, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("discharge_plans").update({ status }).eq("id", id);
    setPlans((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
  }

  function exportPDF(plan: DischargePlan) {
    const client = clients.find((c) => c.id === plan.client_id);
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("DISCHARGE PLAN", 105, 20, { align: "center" });
    doc.setFontSize(11);

    let y = 35;
    const field = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 20, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(value, 140);
      doc.text(lines, 65, y);
      y += Math.max(8, lines.length * 6);
    };

    field("Client", client?.full_name ?? "");
    field("Diagnosis", client?.diagnosis ?? "");
    field("Discharge Date", plan.discharge_date ?? "TBD");
    field("Reason", plan.reason);
    y += 4; doc.line(20, y, 190, y); y += 6;
    field("Goals Mastered", plan.goals_mastered.join(", ") || "None listed");
    field("Goals In Progress", plan.goals_in_progress.join(", ") || "None");
    field("Maintenance Plan", plan.maintenance_plan || "");
    field("Follow-up Recommendations", plan.follow_up_recommendations || "");
    field("Caregiver Training", plan.caregiver_training_completed ? "Completed" : "Not completed");

    doc.save(`discharge-plan-${client?.full_name?.replace(/\s/g, "-")}.pdf`);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  function statusColor(status: string) {
    if (status === "discharged") return "bg-green-100 text-green-700";
    if (status === "in_progress") return "bg-blue-100 text-blue-700";
    if (status === "planning") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-500";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Discharge Planning">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Discharge Plan"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section title="New Discharge Plan">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Discharge Date</label>
              <input type="date" value={form.discharge_date} onChange={(e) => setForm({ ...form, discharge_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reason for Discharge *</label>
              <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select reason...</option>
                {DISCHARGE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* GOALS MASTERED */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Goals Mastered</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={newMastered} onChange={(e) => setNewMastered(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newMastered) { setForm((f) => ({ ...f, goals_mastered: [...f.goals_mastered, newMastered] })); setNewMastered(""); } }}
                placeholder="Add mastered goal..." className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <Button variant="outline" onClick={() => { if (newMastered) { setForm((f) => ({ ...f, goals_mastered: [...f.goals_mastered, newMastered] })); setNewMastered(""); } }}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.goals_mastered.map((g) => (
                <span key={g} className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                  ✓ {g}
                  <button onClick={() => setForm((f) => ({ ...f, goals_mastered: f.goals_mastered.filter((m) => m !== g) }))} className="ml-1 opacity-60 hover:opacity-100">✕</button>
                </span>
              ))}
            </div>
          </div>

          {/* GOALS IN PROGRESS */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Goals In Progress (not yet mastered)</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={newInProgress} onChange={(e) => setNewInProgress(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newInProgress) { setForm((f) => ({ ...f, goals_in_progress: [...f.goals_in_progress, newInProgress] })); setNewInProgress(""); } }}
                placeholder="Add in-progress goal..." className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <Button variant="outline" onClick={() => { if (newInProgress) { setForm((f) => ({ ...f, goals_in_progress: [...f.goals_in_progress, newInProgress] })); setNewInProgress(""); } }}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.goals_in_progress.map((g) => (
                <span key={g} className="text-xs px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                  ⟳ {g}
                  <button onClick={() => setForm((f) => ({ ...f, goals_in_progress: f.goals_in_progress.filter((m) => m !== g) }))} className="ml-1 opacity-60 hover:opacity-100">✕</button>
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Maintenance Plan</label>
              <textarea value={form.maintenance_plan} onChange={(e) => setForm({ ...form, maintenance_plan: e.target.value })}
                placeholder="How will skills be maintained after discharge..." rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Follow-up Recommendations</label>
              <textarea value={form.follow_up_recommendations} onChange={(e) => setForm({ ...form, follow_up_recommendations: e.target.value })}
                placeholder="Recommended services, providers, or resources..." rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setForm((f) => ({ ...f, caregiver_training_completed: !f.caregiver_training_completed }))}
              className={`w-10 h-6 rounded-full transition-all relative ${form.caregiver_training_completed ? "bg-green-500" : "bg-gray-300"}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${form.caregiver_training_completed ? "left-5" : "left-1"}`} />
            </button>
            <label className="text-sm font-medium text-gray-700">Caregiver training completed</label>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Discharge Plan</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && plans.length === 0 && (
        <Section title="Discharge Plans">
          <p className="text-gray-400 text-sm">No discharge plans yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {plans.map((plan) => {
          const isExpanded = expandedId === plan.id;
          return (
            <div key={plan.id} className="border border-gray-100 rounded-xl bg-white">
              <div className="p-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <p className="font-semibold text-gray-800">{clientMap.get(plan.client_id) ?? "Unknown"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {plan.reason}{plan.discharge_date && ` · ${plan.discharge_date}`}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(plan.status)}`}>
                        {plan.status.replace("_", " ")}
                      </span>
                      <span className="text-xs text-gray-500">
                        {plan.goals_mastered.length} mastered · {plan.goals_in_progress.length} in progress
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <select value={plan.status} onChange={(e) => updateStatus(plan.id, e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1 focus:outline-none">
                      {DISCHARGE_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                    <Button variant="outline" onClick={() => exportPDF(plan)}>📄 PDF</Button>
                    <button onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                      className="text-xs text-gray-400 hover:text-gray-600">{isExpanded ? "▲" : "▼"}</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                    {plan.goals_mastered.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Goals Mastered</p>
                        <div className="flex flex-wrap gap-1">
                          {plan.goals_mastered.map((g) => (
                            <span key={g} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">✓ {g}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {plan.goals_in_progress.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Goals In Progress</p>
                        <div className="flex flex-wrap gap-1">
                          {plan.goals_in_progress.map((g) => (
                            <span key={g} className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">⟳ {g}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {plan.maintenance_plan && <p className="text-sm text-gray-600"><span className="font-medium">Maintenance:</span> {plan.maintenance_plan}</p>}
                    {plan.follow_up_recommendations && <p className="text-sm text-gray-600"><span className="font-medium">Follow-up:</span> {plan.follow_up_recommendations}</p>}
                    <p className="text-xs text-gray-500">Caregiver training: {plan.caregiver_training_completed ? "✓ Completed" : "Not completed"}</p>
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