"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";

type Client = { id: string; full_name: string };
type Staff = { id: string; full_name: string; role: string };
type Authorization = {
  id: string; client_id: string; cpt_code: string;
  start_date: string; end_date: string;
  total_units: number; used_units: number; status: string;
  clients?: { full_name: string };
};
type NoteOption = {
  id: string; category: string; option_value: string;
  display_order: number; is_active: boolean;
};

const CATEGORIES = [
  { key: "client_readiness", label: "Client Readiness" },
  { key: "client_disposition", label: "Client Disposition / Transition" },
  { key: "intervention_techniques", label: "Intervention Techniques" },
  { key: "client_response", label: "Client Response to Interventions" },
  { key: "treatment_progress", label: "Treatment Progress" },
  { key: "goal_mastery", label: "Goal Mastery Status" },
  { key: "skill_generalization", label: "Skill Generalization" },
  { key: "client_transition", label: "Client Transition from Session" },
  { key: "antecedents", label: "Antecedents / Barriers" },
  { key: "maladaptive_behaviors", label: "Maladaptive Behaviors" },
  { key: "reinforcement_timing", label: "Reinforcement Timing" },
];

const CPT_OPTIONS = [
  "97153", "97154", "97155", "97156", "97157", "97158", "T1016",
];

export default function BillingSetupPage() {
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [noteOptions, setNoteOptions] = useState<NoteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"authorizations" | "dropdowns" | "assignments">("authorizations");

  // Auth form
  const [authForm, setAuthForm] = useState({
    client_id: "", cpt_code: "97153",
    start_date: "", end_date: "", total_units: 96, status: "approved",
  });
  const [showAuthForm, setShowAuthForm] = useState(false);

  // Dropdown editing
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newOption, setNewOption] = useState("");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: cu } = await supabase.from("company_users").select("company_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(cu?.company_id ?? "");

    const [{ data: clientData }, { data: staffData }, { data: authData }, { data: optionsData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("company_id", cu?.company_id).order("full_name"),
      supabase.from("profiles").select("id, full_name, role").eq("company_id", cu?.company_id).order("full_name"),
      supabase.from("authorizations").select("*, clients(full_name)").eq("created_by", user.id).order("created_at", { ascending: false }),
      supabase.from("clinical_note_options").select("*").eq("company_id", cu?.company_id).eq("is_active", true).order("display_order"),
    ]);

    setClients(clientData ?? []);
    setStaff(staffData ?? []);
    setAuthorizations(authData ?? []);
    setNoteOptions(optionsData ?? []);
    setLoading(false);
  }

  async function saveAuth() {
    if (!authForm.client_id || !authForm.start_date || !authForm.end_date) return;
    setSaving(true);
    await supabase.from("authorizations").insert({
      client_id: authForm.client_id,
      cpt_code: authForm.cpt_code,
      start_date: authForm.start_date,
      end_date: authForm.end_date,
      total_units: authForm.total_units,
      used_units: 0,
      status: authForm.status,
      created_by: userId,
    });
    setAuthForm({ client_id: "", cpt_code: "97153", start_date: "", end_date: "", total_units: 96, status: "approved" });
    setShowAuthForm(false);
    setSaving(false);
    await init();
  }

  async function deleteAuth(id: string) {
    await supabase.from("authorizations").delete().eq("id", id);
    setAuthorizations(prev => prev.filter(a => a.id !== id));
  }

  async function addOption(category: string) {
    if (!newOption.trim()) return;
    const maxOrder = noteOptions.filter(o => o.category === category).length + 1;
    await supabase.from("clinical_note_options").insert({
      company_id: companyId,
      category,
      option_value: newOption.trim(),
      display_order: maxOrder,
      created_by: userId,
    });
    setNewOption("");
    await init();
  }

  async function removeOption(id: string) {
    await supabase.from("clinical_note_options").update({ is_active: false }).eq("id", id);
    setNoteOptions(prev => prev.filter(o => o.id !== id));
  }

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Clinical Setup">
        <p className="text-sm text-gray-500">Manage authorizations, CPT codes, and clinical note options.</p>
      </PageHeader>

      {/* TABS */}
      <div className="flex border-b border-gray-200">
        {[
          { key: "authorizations", label: "🏦 Authorizations" },
          { key: "dropdowns", label: "📋 Clinical Note Options" },
          { key: "assignments", label: "👥 Staff Assignments" },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* AUTHORIZATIONS TAB */}
      {activeTab === "authorizations" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">Manage insurance authorizations per client. These appear in the time entry flow.</p>
            <Button onClick={() => setShowAuthForm(s => !s)}>
              {showAuthForm ? "Cancel" : "+ Add Authorization"}
            </Button>
          </div>

          {showAuthForm && (
            <Section title="New Authorization">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
                  <select value={authForm.client_id} onChange={e => setAuthForm(p => ({ ...p, client_id: e.target.value }))} className={inputClass}>
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">CPT Code *</label>
                  <select value={authForm.cpt_code} onChange={e => setAuthForm(p => ({ ...p, cpt_code: e.target.value }))} className={inputClass}>
                    {CPT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date *</label>
                  <input type="date" value={authForm.start_date} onChange={e => setAuthForm(p => ({ ...p, start_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">End Date *</label>
                  <input type="date" value={authForm.end_date} onChange={e => setAuthForm(p => ({ ...p, end_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Total Units</label>
                  <input type="number" value={authForm.total_units} onChange={e => setAuthForm(p => ({ ...p, total_units: parseInt(e.target.value) || 0 }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                  <select value={authForm.status} onChange={e => setAuthForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={saveAuth} loading={saving}>Save Authorization</Button>
              </div>
            </Section>
          )}

          {loading && <p className="text-gray-400 text-sm">Loading...</p>}
          <div className="space-y-3">
            {authorizations.map(auth => (
              <div key={auth.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-800">{auth.clients?.full_name ?? "Unknown Client"}</p>
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{auth.cpt_code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${auth.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {auth.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{auth.start_date} → {auth.end_date} · {auth.used_units}/{auth.total_units} units used</p>
                </div>
                <button onClick={() => deleteAuth(auth.id)} className="text-gray-300 hover:text-red-400 text-sm transition-colors">✕</button>
              </div>
            ))}
            {!loading && authorizations.length === 0 && (
              <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
                <p className="text-gray-500">No authorizations yet. Add one above.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DROPDOWNS TAB */}
      {activeTab === "dropdowns" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Customize the dropdown options that appear in clinical notes. Changes apply to all staff in your company.</p>
          {CATEGORIES.map(cat => {
            const options = noteOptions.filter(o => o.category === cat.key);
            const isEditing = editingCategory === cat.key;
            return (
              <div key={cat.key} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <button type="button" className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => setEditingCategory(isEditing ? null : cat.key)}>
                  <div>
                    <p className="font-semibold text-gray-800">{cat.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{options.length} options</p>
                  </div>
                  <span className="text-gray-400 text-sm">{isEditing ? "▼" : "▶"}</span>
                </button>
                {isEditing && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {options.map(opt => (
                        <div key={opt.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-full border border-blue-200">
                          <span>{opt.option_value}</span>
                          <button onClick={() => removeOption(opt.id)} className="text-blue-400 hover:text-red-500 ml-1 transition-colors">✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={newOption} onChange={e => setNewOption(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addOption(cat.key)}
                        placeholder="Add new option..."
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      <Button onClick={() => addOption(cat.key)}>Add</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ASSIGNMENTS TAB */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">View and manage which staff members are assigned to which clients. Full assignment management is in the <a href="/dashboard/admin" className="text-blue-500 hover:underline">Admin Panel</a>.</p>
          <div className="space-y-3">
            {clients.map(client => (
              <div key={client.id} className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="font-semibold text-gray-800 mb-2">{client.full_name}</p>
                <AssignedStaff clientId={client.id} companyId={companyId} userId={userId} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssignedStaff({ clientId, companyId, userId }: { clientId: string; companyId: string; userId: string }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("");

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const [{ data: a }, { data: s }] = await Promise.all([
      supabase.from("assignments").select("*, profiles(full_name, role)").eq("client_id", clientId),
      supabase.from("profiles").select("id, full_name, role").eq("company_id", companyId).order("full_name"),
    ]);
    setAssignments(a ?? []);
    setStaff(s ?? []);
  }

  async function addAssignment() {
    if (!selectedStaff) return;
    await supabase.from("assignments").insert({ client_id: clientId, rbt_id: selectedStaff, created_by: userId });
    setAdding(false);
    setSelectedStaff("");
    await load();
  }

  async function removeAssignment(id: string) {
    await supabase.from("assignments").delete().eq("id", id);
    setAssignments(prev => prev.filter(a => a.id !== id));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {assignments.map(a => (
          <div key={a.id} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-3 py-1.5 rounded-full">
            <span>{a.profiles?.full_name ?? "Unknown"}</span>
            <span className="text-gray-400">({a.profiles?.role})</span>
            <button onClick={() => removeAssignment(a.id)} className="text-gray-400 hover:text-red-400 ml-1">✕</button>
          </div>
        ))}
        {assignments.length === 0 && <p className="text-xs text-gray-400">No staff assigned</p>}
      </div>
      {adding ? (
        <div className="flex gap-2">
          <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">Select staff...</option>
            {staff.filter(s => !assignments.find(a => a.rbt_id === s.id)).map(s => (
              <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
            ))}
          </select>
          <Button onClick={addAssignment}>Add</Button>
          <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-xs text-blue-500 hover:underline">+ Assign Staff</button>
      )}
    </div>
  );
}