"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import jsPDF from "jspdf";

type Client = { id: string; full_name: string };
type CrisisPlan = {
  id: string;
  client_id: string;
  warning_signs: string[];
  triggers: string[];
  prevention_strategies: string[];
  de_escalation_steps: string[];
  emergency_contacts: EmergencyContact[];
  safe_environment_checklist: string[];
  physical_intervention_protocol: string | null;
  post_crisis_steps: string | null;
  review_date: string | null;
  created_at: string;
};
type EmergencyContact = { name: string; relationship: string; phone: string };

const DEFAULT_SAFE_ENV = [
  "Remove sharp objects from environment",
  "Clear pathways to exits",
  "Remove other clients from the area",
  "Ensure staff are positioned safely",
  "Check for hazardous materials",
  "Ensure door is accessible",
];

const DEFAULT_DE_ESCALATION = [
  "Use calm, quiet voice",
  "Reduce demands and expectations",
  "Offer preferred items or activities",
  "Use visual supports and timers",
  "Give personal space — avoid crowding",
  "Identify and address the function of behavior",
  "Use planned ignoring if attention-maintained",
  "Redirect to alternative activity",
];

const emptyForm = {
  client_id: "",
  warning_signs: [] as string[],
  triggers: [] as string[],
  prevention_strategies: [] as string[],
  de_escalation_steps: [...DEFAULT_DE_ESCALATION],
  emergency_contacts: [] as EmergencyContact[],
  safe_environment_checklist: [...DEFAULT_SAFE_ENV],
  physical_intervention_protocol: "",
  post_crisis_steps: "",
  review_date: "",
};

export default function CrisisPlansPage() {
  const [plans, setPlans] = useState<CrisisPlan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newWarning, setNewWarning] = useState("");
  const [newTrigger, setNewTrigger] = useState("");
  const [newPrevention, setNewPrevention] = useState("");
  const [newContact, setNewContact] = useState<EmergencyContact>({ name: "", relationship: "", phone: "" });

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: planData }] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase.from("crisis_plans").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setPlans((planData ?? []).map((p: any) => ({
      ...p,
      warning_signs: Array.isArray(p.warning_signs) ? p.warning_signs : JSON.parse(p.warning_signs || "[]"),
      triggers: Array.isArray(p.triggers) ? p.triggers : JSON.parse(p.triggers || "[]"),
      prevention_strategies: Array.isArray(p.prevention_strategies) ? p.prevention_strategies : JSON.parse(p.prevention_strategies || "[]"),
      de_escalation_steps: Array.isArray(p.de_escalation_steps) ? p.de_escalation_steps : JSON.parse(p.de_escalation_steps || "[]"),
      emergency_contacts: Array.isArray(p.emergency_contacts) ? p.emergency_contacts : JSON.parse(p.emergency_contacts || "[]"),
      safe_environment_checklist: Array.isArray(p.safe_environment_checklist) ? p.safe_environment_checklist : JSON.parse(p.safe_environment_checklist || "[]"),
    })));
    setLoading(false);
  }

  function addItem(field: keyof typeof form, value: string) {
    if (!value.trim()) return;
    setForm((f) => ({ ...f, [field]: [...(f[field] as string[]), value.trim()] }));
  }

  function removeItem(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: (f[field] as string[]).filter((i) => i !== value) }));
  }

  function addContact() {
    if (!newContact.name) return;
    setForm((f) => ({ ...f, emergency_contacts: [...f.emergency_contacts, { ...newContact }] }));
    setNewContact({ name: "", relationship: "", phone: "" });
  }

  async function handleSave() {
    if (!form.client_id) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("crisis_plans").insert([{
      client_id: form.client_id,
      warning_signs: JSON.stringify(form.warning_signs),
      triggers: JSON.stringify(form.triggers),
      prevention_strategies: JSON.stringify(form.prevention_strategies),
      de_escalation_steps: JSON.stringify(form.de_escalation_steps),
      emergency_contacts: JSON.stringify(form.emergency_contacts),
      safe_environment_checklist: JSON.stringify(form.safe_environment_checklist),
      physical_intervention_protocol: form.physical_intervention_protocol || null,
      post_crisis_steps: form.post_crisis_steps || null,
      review_date: form.review_date || null,
      created_by: user.id,
    }]).select().single();

    if (data) setPlans((prev) => [{ ...data, ...form }, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  function exportPDF(plan: CrisisPlan) {
    const client = clients.find((c) => c.id === plan.client_id);
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("CRISIS SAFETY PLAN", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Client: ${client?.full_name ?? "Unknown"} | Created: ${new Date(plan.created_at).toLocaleDateString()}`, 105, 28, { align: "center" });
    doc.line(20, 32, 190, 32);

    let y = 40;
    const section = (title: string, items: string[]) => {
      if (!items.length) return;
      doc.setFont("helvetica", "bold");
      doc.text(title, 20, y); y += 6;
      doc.setFont("helvetica", "normal");
      items.forEach((item) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const lines = doc.splitTextToSize(`• ${item}`, 165);
        doc.text(lines, 25, y);
        y += lines.length * 5 + 2;
      });
      y += 4;
    };

    section("⚠️ Warning Signs", plan.warning_signs);
    section("🔥 Triggers", plan.triggers);
    section("🛡️ Prevention Strategies", plan.prevention_strategies);
    section("🔽 De-escalation Steps", plan.de_escalation_steps);
    section("✅ Safe Environment Checklist", plan.safe_environment_checklist);

    if (plan.emergency_contacts.length) {
      doc.setFont("helvetica", "bold");
      doc.text("📞 Emergency Contacts", 20, y); y += 6;
      doc.setFont("helvetica", "normal");
      plan.emergency_contacts.forEach((c) => {
        doc.text(`• ${c.name} (${c.relationship}): ${c.phone}`, 25, y); y += 6;
      });
      y += 4;
    }

    if (plan.physical_intervention_protocol) {
      doc.setFont("helvetica", "bold");
      doc.text("Physical Intervention Protocol", 20, y); y += 6;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(plan.physical_intervention_protocol, 165);
      doc.text(lines, 20, y); y += lines.length * 5 + 6;
    }

    if (plan.post_crisis_steps) {
      doc.setFont("helvetica", "bold");
      doc.text("Post-Crisis Steps", 20, y); y += 6;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(plan.post_crisis_steps, 165);
      doc.text(lines, 20, y);
    }

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("CONFIDENTIAL — Protected Health Information", 105, 290, { align: "center" });

    doc.save(`crisis-plan-${client?.full_name?.replace(/\s/g, "-")}.pdf`);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Crisis Safety Plans">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Crisis Plan"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section title="New Crisis Safety Plan">
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Review Date</label>
              <input type="date" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {[
            { label: "⚠️ Warning Signs", field: "warning_signs" as const, value: newWarning, setValue: setNewWarning, color: "bg-orange-100 text-orange-700" },
            { label: "🔥 Triggers", field: "triggers" as const, value: newTrigger, setValue: setNewTrigger, color: "bg-red-100 text-red-700" },
            { label: "🛡️ Prevention Strategies", field: "prevention_strategies" as const, value: newPrevention, setValue: setNewPrevention, color: "bg-blue-100 text-blue-700" },
          ].map((section) => (
            <div key={section.field} className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">{section.label}</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={section.value} onChange={(e) => section.setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { addItem(section.field, section.value); section.setValue(""); } }}
                  placeholder={`Add ${section.label.split(" ").slice(1).join(" ").toLowerCase()}...`}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <Button variant="outline" onClick={() => { addItem(section.field, section.value); section.setValue(""); }}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(form[section.field] as string[]).map((item) => (
                  <span key={item} className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1 ${section.color}`}>
                    {item}
                    <button onClick={() => removeItem(section.field, item)} className="ml-1 opacity-60 hover:opacity-100">✕</button>
                  </span>
                ))}
              </div>
            </div>
          ))}

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">🔽 De-escalation Steps</label>
            <div className="space-y-1">
              {form.de_escalation_steps.map((step, i) => (
                <div key={step} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2 bg-gray-50 text-sm">
                  <span className="text-gray-400 font-bold w-5">{i + 1}.</span>
                  <span className="flex-1 text-gray-700">{step}</span>
                  <button onClick={() => removeItem("de_escalation_steps", step)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">✅ Safe Environment Checklist</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {form.safe_environment_checklist.map((item) => (
                <div key={item} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2 bg-gray-50 text-xs">
                  <span className="text-green-500">✓</span>
                  <span className="flex-1 text-gray-700">{item}</span>
                  <button onClick={() => removeItem("safe_environment_checklist", item)} className="text-gray-300 hover:text-red-400">✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">📞 Emergency Contacts</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input type="text" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="Name" className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <input type="text" value={newContact.relationship} onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                placeholder="Relationship" className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <div className="flex gap-1">
                <input type="tel" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="Phone" className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <Button variant="outline" onClick={addContact}>Add</Button>
              </div>
            </div>
            <div className="space-y-1">
              {form.emergency_contacts.map((c) => (
                <div key={c.name} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2 bg-gray-50 text-sm">
                  <span className="font-medium text-gray-800">{c.name}</span>
                  <span className="text-gray-400">({c.relationship})</span>
                  <span className="text-blue-600">{c.phone}</span>
                  <button onClick={() => setForm((f) => ({ ...f, emergency_contacts: f.emergency_contacts.filter((ec) => ec.name !== c.name) }))}
                    className="ml-auto text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Physical Intervention Protocol</label>
              <textarea value={form.physical_intervention_protocol ?? ""} onChange={(e) => setForm({ ...form, physical_intervention_protocol: e.target.value })}
                placeholder="If applicable — describe approved physical intervention procedures..." rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Post-Crisis Steps</label>
              <textarea value={form.post_crisis_steps ?? ""} onChange={(e) => setForm({ ...form, post_crisis_steps: e.target.value })}
                placeholder="Steps to take after a crisis — debrief, documentation, parent notification..." rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={!form.client_id}>Save Crisis Plan</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && plans.length === 0 && (
        <Section title="No Crisis Plans Yet">
          <p className="text-gray-400 text-sm">No crisis safety plans yet. Click "+ New Crisis Plan" to create one.</p>
        </Section>
      )}

      <div className="space-y-3">
        {plans.map((plan) => {
          const isExpanded = expandedId === plan.id;
          return (
            <div key={plan.id} className="border border-red-100 rounded-xl bg-white">
              <div className="p-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <p className="font-bold text-gray-800">{clientMap.get(plan.client_id) ?? "Unknown"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Created {new Date(plan.created_at).toLocaleDateString()}
                      {plan.review_date && ` · Review: ${plan.review_date}`}
                    </p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      <span>⚠️ {plan.warning_signs.length} warning signs</span>
                      <span>🔥 {plan.triggers.length} triggers</span>
                      <span>📞 {plan.emergency_contacts.length} contacts</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => exportPDF(plan)}>📄 PDF</Button>
                    <button onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                      className="text-xs text-gray-400 hover:text-gray-600">{isExpanded ? "▲" : "▼"}</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
                    {plan.warning_signs.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-orange-600 mb-1">⚠️ Warning Signs</p>
                        <div className="flex flex-wrap gap-1">
                          {plan.warning_signs.map((s) => <span key={s} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">{s}</span>)}
                        </div>
                      </div>
                    )}
                    {plan.triggers.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-600 mb-1">🔥 Triggers</p>
                        <div className="flex flex-wrap gap-1">
                          {plan.triggers.map((t) => <span key={t} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{t}</span>)}
                        </div>
                      </div>
                    )}
                    {plan.de_escalation_steps.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 mb-1">🔽 De-escalation Steps</p>
                        <ol className="space-y-1">
                          {plan.de_escalation_steps.map((step, i) => (
                            <li key={i} className="text-xs text-gray-700">{i + 1}. {step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {plan.emergency_contacts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">📞 Emergency Contacts</p>
                        {plan.emergency_contacts.map((c) => (
                          <p key={c.name} className="text-xs text-gray-700">{c.name} ({c.relationship}): {c.phone}</p>
                        ))}
                      </div>
                    )}
                    {plan.post_crisis_steps && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Post-Crisis Steps</p>
                        <p className="text-sm text-gray-700">{plan.post_crisis_steps}</p>
                      </div>
                    )}
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