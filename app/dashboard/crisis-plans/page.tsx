"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import jsPDF from "jspdf";
import { useRole } from "@/lib/hooks/useRole";

type Client = { id: string; full_name: string };
type CrisisPlan = {
  id: string;
  client_id: string | null;
  plan_type: "client" | "company";
  title: string;
  description: string;
  trigger_behaviors: string;
  early_warning_signs: string;
  de_escalation_steps: string;
  crisis_response_steps: string;
  post_crisis_steps: string;
  emergency_contacts: string;
  safe_environment_steps: string;
  medications_notes: string;
  communication_strategies: string;
  physical_intervention_notes: string;
  bcba_name: string;
  bcba_phone: string;
  supervisor_name: string;
  supervisor_phone: string;
  emergency_services_notes: string;
  last_reviewed: string;
  status: string;
  created_at: string;
};

const emptyForm = {
  client_id: "",
  plan_type: "client" as "client" | "company",
  title: "",
  description: "",
  trigger_behaviors: "",
  early_warning_signs: "",
  de_escalation_steps: "",
  crisis_response_steps: "",
  post_crisis_steps: "",
  emergency_contacts: "",
  safe_environment_steps: "",
  medications_notes: "",
  communication_strategies: "",
  physical_intervention_notes: "",
  bcba_name: "",
  bcba_phone: "",
  supervisor_name: "",
  supervisor_phone: "",
  emergency_services_notes: "",
  last_reviewed: new Date().toISOString().split("T")[0],
  status: "active",
};

export default function CrisisPlansPage() {
  const [plans, setPlans] = useState<CrisisPlan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "client" | "company">("all");
  const [filterClient, setFilterClient] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 4;
  const { isAdmin, isSupervisor } = useRole();

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: planData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase.from("crisis_plans").select("*").order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setPlans(planData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.title) { setError("Title is required."); return; }
    if (form.plan_type === "client" && !form.client_id) { setError("Please select a client for a client-specific plan."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase.from("crisis_plans").insert([{
      ...form,
      client_id: form.plan_type === "client" ? form.client_id : null,
      created_by: user.id,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }
    setPlans((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setCurrentStep(1);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this crisis plan?")) return;
    await supabase.from("crisis_plans").delete().eq("id", id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }

  function exportPDF(plan: CrisisPlan) {
    const client = clients.find((c) => c.id === plan.client_id);
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("CRISIS INTERVENTION PLAN", 105, y, { align: "center" });
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("CONFIDENTIAL — ABA AI Assistant", 105, y, { align: "center" });
    y += 6;
    doc.line(20, y, 190, y);
    y += 8;

    const field = (label: string, value: string) => {
      if (!value) return;
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${label}:`, 20, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(value, 150);
      doc.text(lines, 60, y);
      y += Math.max(8, lines.length * 5 + 4);
    };

    const section = (title: string) => {
      if (y > 255) { doc.addPage(); y = 20; }
      y += 4;
      doc.setFillColor(240, 240, 240);
      doc.rect(20, y - 4, 170, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title, 22, y + 1);
      doc.setFontSize(10);
      y += 8;
    };

    field("Plan Title", plan.title);
    field("Type", plan.plan_type === "client" ? `Client-Specific — ${client?.full_name ?? "Unknown"}` : "Company-Wide Template");
    field("Status", plan.status.toUpperCase());
    field("Last Reviewed", plan.last_reviewed);
    if (plan.description) field("Description", plan.description);

    section("EMERGENCY CONTACTS");
    field("BCBA", `${plan.bcba_name}${plan.bcba_phone ? ` · ${plan.bcba_phone}` : ""}`);
    field("Supervisor", `${plan.supervisor_name}${plan.supervisor_phone ? ` · ${plan.supervisor_phone}` : ""}`);
    if (plan.emergency_contacts) field("Other Contacts", plan.emergency_contacts);
    if (plan.emergency_services_notes) field("Emergency Services", plan.emergency_services_notes);

    section("TRIGGER BEHAVIORS & WARNING SIGNS");
    if (plan.trigger_behaviors) field("Trigger Behaviors", plan.trigger_behaviors);
    if (plan.early_warning_signs) field("Early Warning Signs", plan.early_warning_signs);

    section("CRISIS RESPONSE");
    if (plan.de_escalation_steps) field("De-Escalation Steps", plan.de_escalation_steps);
    if (plan.crisis_response_steps) field("Crisis Response Steps", plan.crisis_response_steps);
    if (plan.communication_strategies) field("Communication Strategies", plan.communication_strategies);
    if (plan.safe_environment_steps) field("Safe Environment Steps", plan.safe_environment_steps);
    if (plan.physical_intervention_notes) field("Physical Intervention Notes", plan.physical_intervention_notes);

    section("POST-CRISIS");
    if (plan.post_crisis_steps) field("Post-Crisis Steps", plan.post_crisis_steps);
    if (plan.medications_notes) field("Medications Notes", plan.medications_notes);

    y += 16;
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "normal");
    doc.text("BCBA Signature: ________________________  Date: __________", 20, y);
    y += 10;
    doc.text("Caregiver Signature: ________________________  Date: __________", 20, y);

    doc.save(`crisis-plan-${plan.title.replace(/\s/g, "-")}-${plan.last_reviewed}.pdf`);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  let filtered = plans;
  if (filterType !== "all") filtered = filtered.filter((p) => p.plan_type === filterType);
  if (filterClient) filtered = filtered.filter((p) => p.client_id === filterClient);

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
  const STEPS = ["Plan Type & Info", "Contacts & Triggers", "Crisis Response", "Post-Crisis & Review"];

  return (
    <div className="space-y-6">
      <PageHeader title="Crisis Plans">
        <Button onClick={() => { setShowForm(!showForm); setCurrentStep(1); }}>
          {showForm ? "Cancel" : "+ New Crisis Plan"}
        </Button>
      </PageHeader>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
        <p className="font-bold mb-1">🚨 Crisis Plan Guidelines</p>
        <p>Crisis plans must be developed by a BCBA, reviewed regularly, and shared with all team members working with the client. All staff must be trained on crisis procedures before working with a client who has a crisis plan on file.</p>
      </div>

      {showForm && (
        <Section title="New Crisis Plan">
          <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
            {STEPS.map((step, i) => (
              <button key={i} onClick={() => setCurrentStep(i + 1)}
                className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                  currentStep === i + 1 ? "bg-red-600 text-white" : i + 1 < currentStep ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>
                {i + 1 < currentStep ? "✓ " : ""}{step}
              </button>
            ))}
          </div>

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Plan Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setForm({ ...form, plan_type: "client" })}
                    className={`p-4 border-2 rounded-xl text-left transition-all ${form.plan_type === "client" ? "border-red-500 bg-red-50" : "border-gray-200"}`}>
                    <p className="font-semibold text-sm">👤 Client-Specific</p>
                    <p className="text-xs text-gray-500 mt-1">Linked to one client. Tailored to their specific behaviors and needs.</p>
                  </button>
                  <button onClick={() => setForm({ ...form, plan_type: "company" })}
                    className={`p-4 border-2 rounded-xl text-left transition-all ${form.plan_type === "company" ? "border-red-500 bg-red-50" : "border-gray-200"}`}>
                    <p className="font-semibold text-sm">🏢 Company-Wide</p>
                    <p className="text-xs text-gray-500 mt-1">General template for all staff. Applies across the clinic.</p>
                  </button>
                </div>
              </div>
              {form.plan_type === "client" && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
                  <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className={inputClass}>
                    <option value="">Select client...</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Plan Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Aggression Crisis Protocol, Elopement Response Plan" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description / Purpose</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of this plan's purpose and when it should be used..." rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="under_review">Under Review</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">BCBA Name</label>
                  <input type="text" value={form.bcba_name} onChange={(e) => setForm({ ...form, bcba_name: e.target.value })} placeholder="Supervising BCBA" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">BCBA Phone</label>
                  <input type="tel" value={form.bcba_phone} onChange={(e) => setForm({ ...form, bcba_phone: e.target.value })} placeholder="(555) 555-5555" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Supervisor Name</label>
                  <input type="text" value={form.supervisor_name} onChange={(e) => setForm({ ...form, supervisor_name: e.target.value })} placeholder="Clinical supervisor" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Supervisor Phone</label>
                  <input type="tel" value={form.supervisor_phone} onChange={(e) => setForm({ ...form, supervisor_phone: e.target.value })} placeholder="(555) 555-5555" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Other Emergency Contacts</label>
                <textarea value={form.emergency_contacts} onChange={(e) => setForm({ ...form, emergency_contacts: e.target.value })}
                  placeholder="Parent/guardian, pediatrician, psychiatrist — include names and phone numbers..." rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Emergency Services Notes</label>
                <textarea value={form.emergency_services_notes} onChange={(e) => setForm({ ...form, emergency_services_notes: e.target.value })}
                  placeholder="When to call 911, special instructions for emergency responders, hospital preferences..." rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Trigger Behaviors</label>
                <textarea value={form.trigger_behaviors} onChange={(e) => setForm({ ...form, trigger_behaviors: e.target.value })}
                  placeholder="Describe the specific behaviors or situations that indicate a crisis is occurring or escalating..." rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Early Warning Signs</label>
                <textarea value={form.early_warning_signs} onChange={(e) => setForm({ ...form, early_warning_signs: e.target.value })}
                  placeholder="Behavioral indicators that a crisis may be developing — what to watch for before escalation..." rows={3} className={inputClass} />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">De-Escalation Steps</label>
                <textarea value={form.de_escalation_steps} onChange={(e) => setForm({ ...form, de_escalation_steps: e.target.value })}
                  placeholder="Step-by-step procedures to de-escalate the situation before it becomes a full crisis..." rows={4} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Crisis Response Steps</label>
                <textarea value={form.crisis_response_steps} onChange={(e) => setForm({ ...form, crisis_response_steps: e.target.value })}
                  placeholder="Specific steps staff must follow during an active crisis. Be clear and sequential..." rows={4} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Communication Strategies</label>
                <textarea value={form.communication_strategies} onChange={(e) => setForm({ ...form, communication_strategies: e.target.value })}
                  placeholder="How to communicate with the client during crisis — tone, language, AAC device, visual supports..." rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Safe Environment Steps</label>
                <textarea value={form.safe_environment_steps} onChange={(e) => setForm({ ...form, safe_environment_steps: e.target.value })}
                  placeholder="How to modify the environment to ensure safety — remove hazards, clear space, remove other clients..." rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Physical Intervention Notes</label>
                <textarea value={form.physical_intervention_notes} onChange={(e) => setForm({ ...form, physical_intervention_notes: e.target.value })}
                  placeholder="Approved physical intervention procedures, who is trained/authorized, contraindications..." rows={3} className={inputClass} />
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Post-Crisis Steps</label>
                <textarea value={form.post_crisis_steps} onChange={(e) => setForm({ ...form, post_crisis_steps: e.target.value })}
                  placeholder="What to do after the crisis — debriefing, documentation, notifications, client follow-up..." rows={4} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Medications Notes</label>
                <textarea value={form.medications_notes} onChange={(e) => setForm({ ...form, medications_notes: e.target.value })}
                  placeholder="PRN medications, who can administer, dosage, when to use, contraindications..." rows={3} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Last Reviewed / Effective Date</label>
                <input type="date" value={form.last_reviewed} onChange={(e) => setForm({ ...form, last_reviewed: e.target.value })} className={inputClass} />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Plan Summary</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: "Type", value: form.plan_type === "client" ? "Client-Specific" : "Company-Wide" },
                    { label: "Client", value: form.plan_type === "client" ? (clientMap.get(form.client_id) ?? "Not selected") : "N/A" },
                    { label: "BCBA", value: form.bcba_name || "Not set" },
                    { label: "Status", value: form.status },
                    { label: "De-escalation", value: form.de_escalation_steps ? "✓ Filled" : "Empty" },
                    { label: "Crisis Response", value: form.crisis_response_steps ? "✓ Filled" : "Empty" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">{item.label}</span>
                      <span className="font-medium text-gray-700">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-4">
            <Button variant="outline" onClick={() => setCurrentStep((s) => Math.max(1, s - 1))} disabled={currentStep === 1}>← Previous</Button>
            <span className="text-sm text-gray-400">{currentStep} / {TOTAL_STEPS}</span>
            {currentStep < TOTAL_STEPS ? (
              <Button onClick={() => setCurrentStep((s) => Math.min(TOTAL_STEPS, s + 1))}>Next →</Button>
            ) : (
              <Button onClick={handleSave} loading={saving}>💾 Save Crisis Plan</Button>
            )}
          </div>
        </Section>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-lg border border-gray-200 p-1">
          {(["all", "client", "company"] as const).map((type) => (
            <button key={type} onClick={() => setFilterType(type)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${filterType === type ? "bg-red-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
              {type === "all" ? "All Plans" : type === "client" ? "Client-Specific" : "Company-Wide"}
            </button>
          ))}
        </div>
        {filterType !== "company" && (
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        )}
        <p className="text-sm text-gray-400">{filtered.length} plans</p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Crisis Plans">
          <p className="text-gray-400 text-sm">No crisis plans yet. Create one above.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((plan) => {
          const isExpanded = expandedId === plan.id;
          return (
            <div key={plan.id} className={`border rounded-xl bg-white ${plan.status === "active" ? "border-red-100" : "border-gray-100"}`}>
              <div className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-800">{plan.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${plan.status === "active" ? "bg-red-100 text-red-700" : plan.status === "draft" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"}`}>
                        {plan.status}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${plan.plan_type === "client" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {plan.plan_type === "client" ? "👤 Client-Specific" : "🏢 Company-Wide"}
                      </span>
                    </div>
                    {plan.plan_type === "client" && plan.client_id && (
                      <p className="text-xs text-gray-500 mt-0.5">Client: {clientMap.get(plan.client_id) ?? "Unknown"}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      {plan.bcba_name && <span>BCBA: {plan.bcba_name}</span>}
                      <span>Reviewed: {plan.last_reviewed}</span>
                    </div>
                    {plan.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{plan.description}</p>}
                  </div>
                  <div className="flex gap-2 items-center shrink-0">
                    <Button variant="outline" onClick={() => exportPDF(plan)}>📄 PDF</Button>
                    {(isAdmin || isSupervisor) && (
                      <button onClick={() => handleDelete(plan.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    )}
                    <button onClick={() => setExpandedId(isExpanded ? null : plan.id)} className="text-xs text-gray-400 hover:text-gray-600">
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
                    {[
                      { label: "Trigger Behaviors", value: plan.trigger_behaviors },
                      { label: "Early Warning Signs", value: plan.early_warning_signs },
                      { label: "De-Escalation Steps", value: plan.de_escalation_steps },
                      { label: "Crisis Response Steps", value: plan.crisis_response_steps },
                      { label: "Communication Strategies", value: plan.communication_strategies },
                      { label: "Safe Environment Steps", value: plan.safe_environment_steps },
                      { label: "Physical Intervention Notes", value: plan.physical_intervention_notes },
                      { label: "Post-Crisis Steps", value: plan.post_crisis_steps },
                      { label: "Medications Notes", value: plan.medications_notes },
                      { label: "Emergency Contacts", value: plan.emergency_contacts },
                      { label: "Emergency Services Notes", value: plan.emergency_services_notes },
                    ].filter((f) => f.value).map((field) => (
                      <div key={field.label}>
                        <p className="text-xs font-semibold text-gray-500 mb-1">{field.label}</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{field.value}</p>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                      {plan.bcba_name && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500">BCBA</p>
                          <p className="text-sm text-gray-700">{plan.bcba_name}</p>
                          {plan.bcba_phone && <p className="text-xs text-blue-600">{plan.bcba_phone}</p>}
                        </div>
                      )}
                      {plan.supervisor_name && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Supervisor</p>
                          <p className="text-sm text-gray-700">{plan.supervisor_name}</p>
                          {plan.supervisor_phone && <p className="text-xs text-blue-600">{plan.supervisor_phone}</p>}
                        </div>
                      )}
                    </div>
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