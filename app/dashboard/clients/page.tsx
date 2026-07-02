"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { useRole } from "@/lib/hooks/useRole";
import { useRouter } from "next/navigation";
import { usePlanGate } from "@/lib/hooks/usePlanGate";
import UpgradePrompt from "@/components/ui/UpgradePrompt";

type Client = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  diagnosis: string | null;
  goals: string | null;
  created_at: string;
  company_id: string | null;
};

type StaffMember = {
  user_id: string;
  role: string;
  full_name: string;
  email: string;
};

type ClientAssignment = {
  id: string;
  client_id: string;
  user_id: string;
  role: string;
  full_name?: string;
  email?: string;
};

const DIAGNOSES = [
  "Autism Spectrum Disorder (ASD)", "Intellectual Disability", "ADHD",
  "Down Syndrome", "Cerebral Palsy", "Developmental Delay",
  "Language Disorder", "Anxiety Disorder", "Other",
];

const ASSIGNMENT_ROLES = [
  { value: "rbt", label: "RBT / BT", color: "green" },
  { value: "clinician", label: "Clinician", color: "blue" },
  { value: "supervisor", label: "Supervisor", color: "purple" },
  { value: "bcba", label: "BCBA", color: "indigo" },
  { value: "clinical_director", label: "Clinical Director", color: "pink" },
  { value: "director", label: "Director", color: "rose" },
  { value: "admin", label: "Admin", color: "gray" },
  { value: "student_analyst", label: "Student Analyst", color: "yellow" },
  { value: "parent", label: "Parent / Guardian", color: "orange" },
  { value: "office", label: "Office Staff", color: "slate" },
  { value: "accounting", label: "Accounting", color: "teal" },
  { value: "hr", label: "HR", color: "cyan" },
];

const ROLE_COLORS: Record<string, string> = {
  rbt: "bg-green-50 text-green-700 border-green-200",
  clinician: "bg-blue-50 text-blue-700 border-blue-200",
  supervisor: "bg-purple-50 text-purple-700 border-purple-200",
  bcba: "bg-indigo-50 text-indigo-700 border-indigo-200",
  clinical_director: "bg-pink-50 text-pink-700 border-pink-200",
  director: "bg-rose-50 text-rose-700 border-rose-200",
  admin: "bg-gray-50 text-gray-700 border-gray-200",
  student_analyst: "bg-yellow-50 text-yellow-700 border-yellow-200",
  parent: "bg-orange-50 text-orange-700 border-orange-200",
  office: "bg-slate-50 text-slate-700 border-slate-200",
  accounting: "bg-teal-50 text-teal-700 border-teal-200",
  hr: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

const emptyForm = {
  full_name: "", date_of_birth: "", guardian_name: "", guardian_email: "", diagnosis: "", goals: "",
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
  const [clientAssignments, setClientAssignments] = useState<Record<string, ClientAssignment[]>>({});
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Assignment modal state
  const [assigningClientId, setAssigningClientId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRole, setAssignRole] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);

  const { isAdmin, isSupervisor, role } = useRole();
  const { canAddClient, clientCount, limits } = usePlanGate();

  // Only admin, clinical_director, bcba, supervisor can manage assignments
  const canManageAssignments = isAdmin || isSupervisor || ["bcba", "clinical_director"].includes(role as string);
  const canAddClients = isAdmin || isSupervisor;
  const clientGate = canAddClient();

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    setLoading(true);
    setFetchError(null);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { setLoading(false); return; }

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const cid = companyUser?.company_id ?? null;
    setCompanyId(cid);

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

    if (cid) {
      // Fetch all staff in the company with their profiles
      const { data: staffData } = await supabase
        .from("company_users")
        .select("user_id, role, profiles(full_name), auth_users:user_id(email)")
        .eq("company_id", cid)
        .eq("status", "active");

      const staff: StaffMember[] = (staffData ?? []).map((s: any) => ({
        user_id: s.user_id,
        role: s.role,
        full_name: s.profiles?.full_name ?? "",
        email: s.auth_users?.email ?? "",
      }));
      setStaffMembers(staff);

      // Fetch all client_assignments for this company
      const { data: assignData } = await supabase
        .from("client_assignments")
        .select("*")
        .eq("company_id", cid);

      // Group assignments by client_id and enrich with staff info
      const grouped: Record<string, ClientAssignment[]> = {};
      (assignData ?? []).forEach((a: any) => {
        const staffMember = staff.find(s => s.user_id === a.user_id);
        if (!grouped[a.client_id]) grouped[a.client_id] = [];
        grouped[a.client_id].push({
          ...a,
          full_name: staffMember?.full_name || "",
          email: staffMember?.email || "",
        });
      });
      setClientAssignments(grouped);
    }

    setLoading(false);
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Client name is required."); return; }
    if (!companyId) { setError("No company found. Please complete onboarding."); return; }
    if (!clientGate.allowed) return;

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

    // Auto-assign the creator to the new client
    if (data) {
      await supabase.from("client_assignments").insert([{
        client_id: data.id,
        user_id: user.id,
        role: role ?? "clinician",
        company_id: companyId,
        assigned_by: user.id,
      }]).single();
    }

    setClients((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
    init();
  }

  async function handleUpdate(id: string, field: string, value: string) {
    await supabase.from("clients").update({ [field]: value }).eq("id", id);
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  }

  async function addAssignment(clientId: string) {
    if (!assignUserId || !assignRole || !companyId) return;
    setAssignSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    const { error } = await supabase.from("client_assignments").insert([{
      client_id: clientId,
      user_id: assignUserId,
      role: assignRole,
      company_id: companyId,
      assigned_by: user?.id,
    }]);

    if (!error) {
      setAssignUserId("");
      setAssignRole("");
      await init();
    }
    setAssignSaving(false);
  }

  async function removeAssignment(clientId: string, userId: string) {
    await supabase.from("client_assignments")
      .delete()
      .eq("client_id", clientId)
      .eq("user_id", userId);
    await init();
  }

  function getAge(dob: string | null) {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }

  function getDisplayName(member: ClientAssignment) {
    return member.full_name || member.email || "Unknown";
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

  // Filter out already-assigned staff from dropdown
  const getAvailableStaff = (clientId: string) => {
    const assigned = (clientAssignments[clientId] ?? []).map(a => a.user_id);
    return staffMembers.filter(s => !assigned.includes(s.user_id));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Clients / Learners">
        {canAddClients && (
          clientGate.allowed ? (
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? "Cancel" : "+ Add Client"}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-orange-600 font-medium">
                {clientCount}/{limits.clients} clients
              </span>
              <Link href="/dashboard/settings/billing"
                className="text-xs bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors font-medium">
                🔒 Upgrade to add more
              </Link>
            </div>
          )
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

      {!clientGate.allowed && canAddClients && (
        <UpgradePrompt
          reason={clientGate.reason!}
          upgradeTo={clientGate.upgradeTo}
          feature="Adding more clients"
        />
      )}

      {/* ADD CLIENT FORM */}
      {showForm && canAddClients && clientGate.allowed && (
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Guardian Email</label>
              <input type="email" value={form.guardian_email ?? ""}
                onChange={(e) => setForm({ ...form, guardian_email: e.target.value })}
                placeholder="parent@email.com"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <p className="text-xs text-gray-400 mt-1">Used to link the parent portal account to this client.</p>
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
          {canAddClients && clientGate.allowed && (
            <Button onClick={() => setShowForm(true)}>+ Add First Client</Button>
          )}
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
          const assignments = clientAssignments[client.id] ?? [];

          return (
            <div key={client.id} className="border border-gray-100 rounded-xl bg-white hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 truncate">{client.full_name}</p>
                      <Link href={`/dashboard/clients/${client.id}`} onClick={e => e.stopPropagation()}
                        className="text-xs text-blue-500 hover:underline shrink-0">View Profile →</Link>
                    </div>
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

                {/* Show assigned staff badges */}
                {assignments.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {assignments.slice(0, 3).map(a => (
                      <span key={a.id} className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[a.role] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}>
                        {a.role.replace("_", " ")}: {getDisplayName(a).split(" ")[0]}
                      </span>
                    ))}
                    {assignments.length > 3 && (
                      <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full border border-gray-200">
                        +{assignments.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {assignments.length === 0 && canManageAssignments && (
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

                    {/* Edit Assignment — only for authorized roles */}
                    {canManageAssignments && (
                      <div className="border-t border-gray-100 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setAssigningClientId(client.id);
                            setAssignUserId("");
                            setAssignRole("");
                          }}
                          className="text-xs text-blue-600 hover:underline font-medium">
                          {assignments.length > 0 ? "✏️ Edit Assignments" : "➕ Assign Staff"}
                        </button>
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

      {/* ASSIGNMENT MODAL */}
      {assigningClientId && canManageAssignments && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setAssigningClientId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Manage Staff Assignments</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {clients.find(c => c.id === assigningClientId)?.full_name}
                  </p>
                </div>
                <button onClick={() => setAssigningClientId(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none">×</button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Current Assignments */}
              {(clientAssignments[assigningClientId] ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Currently Assigned ({(clientAssignments[assigningClientId] ?? []).length})
                  </p>
                  <div className="space-y-2">
                    {Object.entries(
                      (clientAssignments[assigningClientId] ?? []).reduce((acc, a) => {
                        if (!acc[a.role]) acc[a.role] = [];
                        acc[a.role].push(a);
                        return acc;
                      }, {} as Record<string, ClientAssignment[]>)
                    ).map(([role, members]) => (
                      <div key={role} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2 capitalize">
                          {role.replace("_", " ")}
                        </p>
                        <div className="space-y-1.5">
                          {members.map(m => (
                            <div key={m.user_id}
                              className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                              <div>
                                <span className="text-sm text-gray-800 font-medium">
                                  {getDisplayName(m)}
                                </span>
                                {m.email && m.full_name && (
                                  <span className="text-xs text-gray-400 ml-2">{m.email}</span>
                                )}
                              </div>
                              <button
                                onClick={() => removeAssignment(assigningClientId, m.user_id)}
                                className="text-xs text-red-400 hover:text-red-600 font-medium ml-3 shrink-0">
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(clientAssignments[assigningClientId] ?? []).length === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">No staff assigned yet</p>
                </div>
              )}

              {/* Add New Assignment */}
              <div className="border-t border-gray-100 pt-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">Add Staff Member</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Staff Member</label>
                    <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="">Select staff member...</option>
                      {getAvailableStaff(assigningClientId).map(s => (
                        <option key={s.user_id} value={s.user_id}>
                          {s.full_name || s.email} — {s.role.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                    {getAvailableStaff(assigningClientId).length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">All staff members are already assigned.</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Role for this client</label>
                    <select value={assignRole} onChange={e => setAssignRole(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="">Select role...</option>
                      {ASSIGNMENT_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => addAssignment(assigningClientId)}
                    disabled={!assignUserId || !assignRole || assignSaving}
                    className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {assignSaving ? "Adding..." : "+ Add to Client"}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setAssigningClientId(null)}
                className="w-full text-sm text-gray-600 py-2 hover:text-gray-900 font-medium">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
