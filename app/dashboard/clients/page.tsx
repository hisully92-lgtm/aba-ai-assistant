"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { useRole } from "@/lib/hooks/useRole";

type Client = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  guardian_name: string | null;
  diagnosis: string | null;
  goals: string | null;
  created_at: string;
  company_id: string | null;
};

type StaffMember = {
  user_id: string;
  role: string;
  full_name: string;
};

type Assignment = {
  id: string;
  client_id: string;
  rbt_id: string | null;
  supervisor_id: string | null;
};

const DIAGNOSES = [
  "Autism Spectrum Disorder (ASD)", "Intellectual Disability", "ADHD",
  "Down Syndrome", "Cerebral Palsy", "Developmental Delay",
  "Language Disorder", "Anxiety Disorder", "Other",
];

const emptyForm = {
  full_name: "", date_of_birth: "", guardian_name: "", diagnosis: "", goals: "",
};

function ClientSkeleton() {
  return (
    <div className="border border-gray-100 rounded-xl bg-white p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="h-5 bg-gray-200 rounded-full w-32" />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="h-8 bg-gray-200 rounded-lg" />
        <div className="h-8 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDiagnosis, setFilterDiagnosis] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [assigningClientId, setAssigningClientId] = useState<string | null>(null);
  const [assignRbt, setAssignRbt] = useState("");
  const [assignSupervisor, setAssignSupervisor] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);

  const { isAdmin, isSupervisor, role } = useRole();
  const canManageAssignments = isAdmin || isSupervisor;
  const canAddClients = isAdmin || isSupervisor;

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    setFetchError(null);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { setLoading(false); return; }

    // Get company
    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const cid = companyUser?.company_id ?? null;
    setCompanyId(cid);

    // Load clients — RLS handles role-based filtering automatically
    const { data: clientData, error: clientErr } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (clientErr) {
      setFetchError("Failed to load clients. Please refresh and try again.");
      setLoading(false);
      return;
    }

    setClients(clientData ?? []);

    // Load assignments and staff for admin/supervisor
    if (cid) {
      const [{ data: assignData }, { data: staffData }] = await Promise.all([
        supabase.from("assignments").select("*"),
        supabase.from("company_users")
          .select("user_id, role, profiles(full_name)")
          .eq("company_id", cid)
          .eq("status", "active")
          .in("role", ["clinician", "rbt", "bt", "supervisor", "bcba", "clinical_director"]),
      ]);

      setAssignments(assignData ?? []);
      setStaffMembers(
        (staffData ?? []).map((s: any) => ({
          user_id: s.user_id,
          role: s.role,
          full_name: s.profiles?.full_name ?? "Unknown",
        }))
      );
    }

    setLoading(false);
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Client name is required."); return; }
    if (!companyId) { setError("No company found. Please complete onboarding."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase
      .from("clients")
      .insert([{ ...form, created_by: user.id, company_id: companyId }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    // Auto-create assignment for the creator if they are RBT/BT/clinician
    if (data && role && ["clinician", "rbt", "bt"].includes(role)) {
      await supabase.from("assignments").insert([{
        client_id: data.id,
        rbt_id: user.id,
        supervisor_id: null,
        created_by: user.id,
      }]);
    }

    // If supervisor creates client, auto-assign themselves as supervisor
    if (data && role && ["supervisor", "bcba"].includes(role)) {
      await supabase.from("assignments").insert([{
        client_id: data.id,
        rbt_id: null,
        supervisor_id: user.id,
        created_by: user.id,
      }]);
    }

    setClients((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
    init(); // refresh assignments
  }

  async function handleUpdate(id: string, field: string, value: string) {
    await supabase.from("clients").update({ [field]: value }).eq("id", id);
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  }

  async function handleAssignSave(clientId: string) {
    setAssignSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    // Remove existing assignments for this client
    await supabase.from("assignments").delete().eq("client_id", clientId);

    // Create new assignment
    if (assignRbt || assignSupervisor) {
      await supabase.from("assignments").insert([{
        client_id: clientId,
        rbt_id: assignRbt || null,
        supervisor_id: assignSupervisor || null,
        created_by: user.id,
      }]);
    }

    setAssignSaving(false);
    setAssigningClientId(null);
    setAssignRbt("");
    setAssignSupervisor("");
    init();
  }

  function getAssignment(clientId: string) {
    return assignments.find((a) => a.client_id === clientId);
  }

  function getStaffName(userId: string | null) {
    if (!userId) return null;
    return staffMembers.find((s) => s.user_id === userId)?.full_name ?? "Unknown";
  }

  function getAge(dob: string | null) {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }

  let filtered = clients;
  if (search.trim()) {
    filtered = filtered.filter((c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.guardian_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.diagnosis ?? "").toLowerCase().includes(search.toLowerCase())
    );
  }
  if (filterDiagnosis) filtered = filtered.filter((c) => c.diagnosis === filterDiagnosis);

  const rbts = staffMembers.filter((s) => ["clinician", "rbt", "bt"].includes(s.role));
  const supervisors = staffMembers.filter((s) => ["supervisor", "bcba", "clinical_director", "admin"].includes(s.role));

  return (
    <div className="space-y-6">
      <PageHeader title="Clients / Learners">
        {canAddClients && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Client"}
          </Button>
        )}
      </PageHeader>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Client added successfully.
        </div>
      )}

      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex justify-between items-center">
          <span>{fetchError}</span>
          <button onClick={init} className="text-xs underline font-medium">Retry</button>
        </div>
      )}

      {showForm && canAddClients && (
        <Section title="Add New Client">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
              <input type="text" value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Client full name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date of Birth</label>
              <input type="date" value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Guardian Name</label>
              <input type="text" value={form.guardian_name}
                onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                placeholder="Parent or guardian"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Diagnosis</label>
              <select value={form.diagnosis}
                onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select diagnosis...</option>
                {DIAGNOSES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Goals</label>
              <textarea value={form.goals}
                onChange={(e) => setForm({ ...form, goals: e.target.value })}
                placeholder="Client's treatment goals..." rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Client</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</Button>
          </div>
        </Section>
      )}

      {!loading && clients.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <select value={filterDiagnosis} onChange={(e) => setFilterDiagnosis(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-full sm:w-auto">
            <option value="">All Diagnoses</option>
            {DIAGNOSES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} of {clients.length} clients</p>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <ClientSkeleton key={i} />)}
        </div>
      )}

      {!loading && !fetchError && clients.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl bg-white">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-gray-700 font-semibold text-lg">No clients yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-6">
            {canAddClients
              ? "Add your first client to start tracking sessions, goals, and progress."
              : "No clients have been assigned to you yet. Contact your administrator."}
          </p>
          {canAddClients && <Button onClick={() => setShowForm(true)}>+ Add First Client</Button>}
        </div>
      )}

      {!loading && clients.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl bg-white">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-600 font-medium">No clients match your search</p>
          <button onClick={() => { setSearch(""); setFilterDiagnosis(""); }}
            className="text-blue-500 text-sm mt-2 hover:underline">Clear filters</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client) => {
          const age = getAge(client.date_of_birth);
          const isExpanded = expandedId === client.id;
          const assignment = getAssignment(client.id);
          const isAssigning = assigningClientId === client.id;

          return (
            <div key={client.id} className="border border-gray-100 rounded-xl bg-white hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{client.full_name}</p>
                    {age !== null && <p className="text-xs text-gray-400 mt-0.5">Age: {age}</p>}
                    {client.guardian_name && <p className="text-xs text-gray-400 truncate">Guardian: {client.guardian_name}</p>}
                    {client.diagnosis && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                        {client.diagnosis}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : client.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 ml-2 shrink-0">
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>

                {/* ASSIGNMENT BADGES */}
                {assignment && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {assignment.rbt_id && (
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">
                        RBT: {getStaffName(assignment.rbt_id)}
                      </span>
                    )}
                    {assignment.supervisor_id && (
                      <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-200">
                        Supervisor: {getStaffName(assignment.supervisor_id)}
                      </span>
                    )}
                  </div>
                )}

                {!assignment && canManageAssignments && (
                  <p className="text-xs text-orange-500 mt-1">⚠️ No staff assigned</p>
                )}

                {isExpanded && (
                  <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                    {canManageAssignments && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Diagnosis</label>
                        <select value={client.diagnosis ?? ""}
                          onChange={(e) => handleUpdate(client.id, "diagnosis", e.target.value)}
                          className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300">
                          <option value="">Select diagnosis...</option>
                          {DIAGNOSES.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Goals</label>
                      <textarea value={client.goals ?? ""}
                        onChange={(e) => handleUpdate(client.id, "goals", e.target.value)}
                        placeholder="Treatment goals..." rows={3}
                        className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>

                    {/* ASSIGNMENT MANAGEMENT — admin/supervisor only */}
                    {canManageAssignments && (
                      <div className="border-t border-gray-100 pt-3">
                        {!isAssigning ? (
                          <button
                            type="button"
                            onClick={() => {
                              setAssigningClientId(client.id);
                              setAssignRbt(assignment?.rbt_id ?? "");
                              setAssignSupervisor(assignment?.supervisor_id ?? "");
                            }}
                            className="text-xs text-blue-600 hover:underline">
                            {assignment ? "✏️ Edit Assignment" : "➕ Assign Staff"}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-600">Assign Staff</p>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">RBT / BT / Clinician</label>
                              <select value={assignRbt} onChange={(e) => setAssignRbt(e.target.value)}
                                className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300">
                                <option value="">None</option>
                                {rbts.map((s) => (
                                  <option key={s.user_id} value={s.user_id}>{s.full_name} ({s.role})</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Supervisor / BCBA</label>
                              <select value={assignSupervisor} onChange={(e) => setAssignSupervisor(e.target.value)}
                                className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300">
                                <option value="">None</option>
                                {supervisors.map((s) => (
                                  <option key={s.user_id} value={s.user_id}>{s.full_name} ({s.role})</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => handleAssignSave(client.id)}
                                disabled={assignSaving}
                                className="flex-1 text-xs py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {assignSaving ? "Saving..." : "Save Assignment"}
                              </button>
                              <button type="button" onClick={() => setAssigningClientId(null)}
                                className="flex-1 text-xs py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button type="button" onClick={() => window.location.href = `/dashboard/clients/${client.id}/case`}
                    className="text-xs px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors">
                    Case
                  </button>
                  <button type="button" onClick={() => window.location.href = `/dashboard/clients/${client.id}/timeline`}
                    className="text-xs px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 font-medium transition-colors">
                    Timeline
                  </button>
                  <button type="button" onClick={() => window.location.href = `/dashboard/clients/${client.id}/exports`}
                    className="text-xs px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors">
                    Exports
                  </button>
                  <button type="button" onClick={() => window.location.href = `/dashboard/clinician/${client.id}`}
                    className="text-xs px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium transition-colors">
                    Clinician
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}