"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type Profile = { id: string; full_name: string | null; role: string | null };
type Client = { id: string; full_name: string };
type HourEntry = {
  id: string;
  student_id: string;
  supervisor_id: string | null;
  hour_type: string;
  bacb_category: string;
  activity_type: string;
  client_id: string | null;
  client_specific: boolean;
  counts_toward_fieldwork: boolean;
  hours: number;
  session_date: string;
  notes: string | null;
  push_to_session: boolean;
  student_signed: boolean;
  student_signed_at: string | null;
  supervisor_signed: boolean;
  supervisor_signed_at: string | null;
  approved: boolean;
  created_at: string;
};

type MVF = {
  id: string;
  month: number;
  year: number;
  total_hours: number;
  supervised_hours: number;
  independent_hours: number;
  experience_type: string | null;
  tasks_completed: string[] | null;
  student_signature: string | null;
  student_signed_at: string | null;
  supervisor_signature: string | null;
  supervisor_signed_at: string | null;
  supervisor_user_id: string | null;
  status: string;
  notes: string | null;
};

const RESTRICTED_ACTIVITIES = [
  "Directly delivering behavior-analytic programs",
  "Implementing Behavior Intervention Plans (BIPs)",
  "Running skill acquisition protocols with client",
  "Running behavior reduction protocols with client",
  "Taking real-time data during direct sessions",
  "Running DTT (Discrete Trial Teaching)",
  "Running NET (Natural Environment Teaching)",
];

const UNRESTRICTED_ACTIVITIES = [
  "Conducting skill assessments (VB-MAPP, AFLS, ABLLS-R)",
  "Designing data collection systems",
  "Writing operational definitions",
  "Visual analysis of data / graphing trends",
  "Interobserver Agreement (IOA) checks",
  "Treatment integrity checks",
  "Conducting functional analyses (FA)",
  "Conducting preference assessments",
  "Designing skill acquisition programs",
  "Writing Behavior Intervention Plans (BIPs)",
  "Writing behavior reduction plans",
  "Developing fading/discharge plans",
  "Conducting intake interviews",
  "Risk-benefit analysis for interventions",
  "Providing performance feedback to RBTs",
  "Developing parent training materials",
  "Delivering BST (Behavioral Skills Training)",
  "Reviewing literature related to current clients",
  "Conducting functional behavior assessments (FBA)",
  "Modifying treatment plans based on data",
];

const DOES_NOT_COUNT = [
  "General coursework / studying for exam",
  "Non-behavior-analytic tasks (CPR, cleaning)",
  "Hypothetical/generic tasks not tied to client",
  "Readings unrelated to current clients",
  "Attending conferences or ACE events",
  "Listening to podcasts",
  "Completing university homework",
  "Teaching at RBT Professional Development events",
];

const BACB_TASKS = [
  "Measurement", "Skill Acquisition", "Behavior Reduction",
  "Documentation", "Supervision", "Ethics", "Experimental Design",
  "Behavioral Assessment", "Personnel Supervision", "Systems Support",
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const BCBA_REQUIREMENTS = { total: 2000, unrestricted_min_pct: 60, restricted_max_pct: 40 };
const BCABA_REQUIREMENTS = { total: 1000, unrestricted_min_pct: 40, restricted_max_pct: 60 };

const emptyForm = {
  hour_type: "unrestricted",
  bacb_category: "unrestricted",
  activity_type: "",
  client_id: "",
  supervisor_id: "",
  hours: 1,
  client_specific: true,
  counts_toward_fieldwork: true,
  session_date: new Date().toISOString().split("T")[0],
  notes: "",
  push_to_session: false,
  student_signature: "",
};

export default function StudentHubPage() {
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [mvfs, setMvfs] = useState<MVF[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [certGoal, setCertGoal] = useState<"bcba" | "bcaba">("bcba");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"tracker" | "mvf" | "activities" | "requirements">("tracker");
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");

  // MVF form
  const [showMVFForm, setShowMVFForm] = useState(false);
  const [mvfMonth, setMvfMonth] = useState(new Date().getMonth() + 1);
  const [mvfYear, setMvfYear] = useState(new Date().getFullYear());
  const [mvfSupervisorId, setMvfSupervisorId] = useState("");
  const [expType, setExpType] = useState("diversified");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [mvfNotes, setMvfNotes] = useState("");
  const [mvfStudentSig, setMvfStudentSig] = useState("");
  const [savingMVF, setSavingMVF] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    setCompanyId(companyUser?.company_id ?? "");

    const [{ data: profileData }, { data: clientData }, { data: entryData }, { data: mvfData }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, role").in("role", ["supervisor", "clinical_director", "admin", "developer"]),
      supabase.from("clients").select("id, full_name"),
      supabase.from("student_analyst_hours").select("*").eq("student_id", user.id).order("session_date", { ascending: false }),
      supabase.from("student_mvf").select("*").eq("student_user_id", user.id).order("year", { ascending: false }).order("month", { ascending: false }),
    ]);

    setProfiles(profileData ?? []);
    setClients(clientData ?? []);
    setEntries(entryData ?? []);
    setMvfs(mvfData ?? []);
    setLoading(false);
  }

  function handleHourTypeChange(type: string) {
    setForm((prev) => ({ ...prev, hour_type: type, bacb_category: type, activity_type: "" }));
  }

  async function handleSave() {
    if (!form.activity_type || !form.hours) { setError("Activity type and hours are required."); return; }
    if (!form.client_id && form.counts_toward_fieldwork) { setError("All fieldwork hours must be tied to a specific client."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase.from("student_analyst_hours").insert([{
      ...form,
      student_id: user.id,
      supervisor_id: form.supervisor_id || null,
      client_id: form.client_id || null,
      student_signed: !!form.student_signature.trim(),
      student_signed_at: form.student_signature.trim() ? new Date().toISOString() : null,
      created_by: user.id,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    // Push notes to session if requested
    if (form.push_to_session && form.notes.trim() && form.client_id) {
      await supabase.from("sessions").insert({
        client_id: form.client_id,
        created_by: user.id,
        date: form.session_date,
        status: "pending",
        behaviors_observed: form.notes.trim(),
      });
    }

    setEntries((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("student_analyst_hours").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function studentSignEntry(id: string) {
    const sig = prompt("Enter your full name as electronic signature:");
    if (!sig) return;
    await supabase.from("student_analyst_hours").update({
      student_signed: true,
      student_signed_at: new Date().toISOString(),
    }).eq("id", id);
    await init();
  }

  async function handleCreateMVF() {
    if (!mvfMonth || !mvfYear) return;
    setSavingMVF(true);

    const monthHours = entries.filter(h => {
      const d = new Date(h.session_date);
      return d.getMonth() + 1 === mvfMonth && d.getFullYear() === mvfYear;
    });

    const totalHours = monthHours.reduce((sum, h) => sum + h.hours, 0);
    const supervisedHours = monthHours.filter(h => h.hour_type === "restricted").reduce((sum, h) => sum + h.hours, 0);

    await supabase.from("student_mvf").insert({
      student_user_id: userId,
      company_id: companyId,
      supervisor_user_id: mvfSupervisorId || null,
      month: mvfMonth,
      year: mvfYear,
      total_hours: totalHours,
      supervised_hours: supervisedHours,
      independent_hours: totalHours - supervisedHours,
      experience_type: expType,
      tasks_completed: selectedTasks.length > 0 ? selectedTasks : null,
      student_signature: mvfStudentSig.trim() || null,
      student_signed_at: mvfStudentSig.trim() ? new Date().toISOString() : null,
      status: mvfStudentSig.trim() ? "student_signed" : "draft",
      notes: mvfNotes.trim() || null,
    });

    setMvfStudentSig(""); setMvfNotes(""); setSelectedTasks([]);
    setShowMVFForm(false);
    await init();
    setSavingMVF(false);
  }

  async function studentSignMVF(id: string) {
    const sig = prompt("Enter your full name as electronic signature:");
    if (!sig) return;
    await supabase.from("student_mvf").update({
      student_signature: sig,
      student_signed_at: new Date().toISOString(),
      status: "student_signed",
    }).eq("id", id);
    await init();
  }

  function toggleTask(task: string) {
    setSelectedTasks(prev => prev.includes(task) ? prev.filter(t => t !== task) : [...prev, task]);
  }

  const filtered = filterType ? entries.filter((e) => e.hour_type === filterType) : entries;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? "Unknown"]));
  const req = certGoal === "bcba" ? BCBA_REQUIREMENTS : BCABA_REQUIREMENTS;

  const fieldworkEntries = entries.filter((e) => e.counts_toward_fieldwork !== false);
  const totalHours = fieldworkEntries.reduce((a, b) => a + b.hours, 0);
  const unrestrictedHours = fieldworkEntries.filter((e) => e.hour_type === "unrestricted").reduce((a, b) => a + b.hours, 0);
  const restrictedHours = fieldworkEntries.filter((e) => e.hour_type === "restricted").reduce((a, b) => a + b.hours, 0);
  const approvedHours = fieldworkEntries.filter((e) => e.approved).reduce((a, b) => a + b.hours, 0);
  const pendingSignature = entries.filter(h => !h.student_signed).length;

  const totalPct = Math.min(100, Math.round((totalHours / req.total) * 100));
  const unrestrictedPct = totalHours > 0 ? Math.round((unrestrictedHours / totalHours) * 100) : 0;
  const restrictedPct = totalHours > 0 ? Math.round((restrictedHours / totalHours) * 100) : 0;
  const unrestrictedMet = unrestrictedPct >= req.unrestricted_min_pct;
  const restrictedMet = restrictedPct <= req.restricted_max_pct;

  const monthlyData = entries.reduce((acc, entry) => {
    const month = entry.session_date.slice(0, 7);
    const existing = acc.find((a) => a.month === month);
    if (existing) {
      if (entry.hour_type === "unrestricted") existing.unrestricted += entry.hours;
      else existing.restricted += entry.hours;
    } else {
      acc.push({
        month,
        unrestricted: entry.hour_type === "unrestricted" ? entry.hours : 0,
        restricted: entry.hour_type === "restricted" ? entry.hours : 0,
      });
    }
    return acc;
  }, [] as { month: string; unrestricted: number; restricted: number }[]).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

  const pieData = [
    { name: "Unrestricted", value: unrestrictedHours, color: "#16a34a" },
    { name: "Restricted", value: restrictedHours, color: "#2563eb" },
    { name: "Remaining", value: Math.max(0, req.total - totalHours), color: "#e5e7eb" },
  ];

  const STATUS_COLORS: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    student_signed: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Student Analyst Hub">
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
            {(["bcba", "bcaba"] as const).map((g) => (
              <button key={g} onClick={() => setCertGoal(g)}
                className={`px-3 py-1 rounded text-xs font-medium uppercase transition-colors ${certGoal === g ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
                {g}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Log Hours"}
          </Button>
        </div>
      </PageHeader>

      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Hours logged successfully.</div>}

      {pendingSignature > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800">
          ✍️ You have <strong>{pendingSignature}</strong> hour entr{pendingSignature > 1 ? "ies" : "y"} waiting for your signature.
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: "tracker", label: "Hour Tracker" },
          { key: "mvf", label: `MVF (${mvfs.length})` },
          { key: "activities", label: "Activity Reference" },
          { key: "requirements", label: "BACB Requirements" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TRACKER TAB */}
      {activeTab === "tracker" && (
        <>
          {totalHours > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className={`border rounded-xl p-3 ${unrestrictedMet ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                <p className={`text-sm font-bold ${unrestrictedMet ? "text-green-700" : "text-red-700"}`}>
                  {unrestrictedMet ? "✓" : "⚠️"} Unrestricted: {unrestrictedPct}% (min {req.unrestricted_min_pct}% required)
                </p>
                <p className={`text-xs mt-0.5 ${unrestrictedMet ? "text-green-600" : "text-red-600"}`}>
                  {unrestrictedHours.toFixed(1)}h · {unrestrictedMet ? "Compliant" : `Need ${((req.unrestricted_min_pct / 100 * totalHours) - unrestrictedHours).toFixed(1)}h more`}
                </p>
              </div>
              <div className={`border rounded-xl p-3 ${restrictedMet ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                <p className={`text-sm font-bold ${restrictedMet ? "text-green-700" : "text-red-700"}`}>
                  {restrictedMet ? "✓" : "⚠️"} Restricted: {restrictedPct}% (max {req.restricted_max_pct}% allowed)
                </p>
                <p className={`text-xs mt-0.5 ${restrictedMet ? "text-green-600" : "text-red-600"}`}>
                  {restrictedHours.toFixed(1)}h · {restrictedMet ? "Compliant" : "Over limit — shift hours to unrestricted"}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-xl p-4 bg-white">
              <p className="text-sm font-medium text-gray-700 mb-2">Total Fieldwork Hours</p>
              <p className="text-3xl font-bold text-blue-600">{totalHours.toFixed(1)}</p>
              <p className="text-xs text-gray-400 mt-1">of {req.total} required</p>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${totalPct}%` }} />
              </div>
              <p className="text-xs text-blue-600 mt-1">{totalPct}% complete</p>
            </div>
            <div className="border rounded-xl p-4 bg-white">
              <p className="text-sm font-medium text-gray-700 mb-2">Unrestricted (min {req.unrestricted_min_pct}%)</p>
              <p className="text-3xl font-bold text-green-600">{unrestrictedHours.toFixed(1)}h</p>
              <p className="text-xs text-gray-400 mt-1">{unrestrictedPct}% of total</p>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${unrestrictedMet ? "bg-green-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, unrestrictedPct)}%` }} />
              </div>
              <p className={`text-xs mt-1 ${unrestrictedMet ? "text-green-600" : "text-red-600"}`}>
                {unrestrictedMet ? "✓ Compliant" : `Need ${req.unrestricted_min_pct}%`}
              </p>
            </div>
            <div className="border rounded-xl p-4 bg-white">
              <p className="text-sm font-medium text-gray-700 mb-2">Restricted (max {req.restricted_max_pct}%)</p>
              <p className="text-3xl font-bold text-blue-600">{restrictedHours.toFixed(1)}h</p>
              <p className="text-xs text-gray-400 mt-1">{restrictedPct}% of total</p>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${restrictedMet ? "bg-blue-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, restrictedPct)}%` }} />
              </div>
              <p className={`text-xs mt-1 ${restrictedMet ? "text-blue-600" : "text-red-600"}`}>
                {restrictedMet ? "✓ Within limit" : "⚠️ Over limit"}
              </p>
            </div>
          </div>

          {entries.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section title="Monthly Hours">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="unrestricted" stroke="#16a34a" strokeWidth={2} name="Unrestricted" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="restricted" stroke="#2563eb" strokeWidth={2} name="Restricted" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Section>
              <Section title="Hour Distribution">
                <div className="flex items-center gap-4">
                  <PieChart width={140} height={140}>
                    <Pie data={pieData} cx={65} cy={65} innerRadius={35} outerRadius={60} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                  <div className="space-y-2">
                    {pieData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-gray-600">{item.name}: {item.value.toFixed(1)}h</span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 mt-1">✓ {approvedHours.toFixed(1)}h approved</p>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {showForm && (
            <Section title="Log Fieldwork Hours">
              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <button onClick={() => handleHourTypeChange("unrestricted")}
                  className={`text-left border-2 rounded-xl p-4 transition-all ${form.hour_type === "unrestricted" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-300"}`}>
                  <p className="text-sm font-bold text-green-700">Unrestricted (min {req.unrestricted_min_pct}%)</p>
                  <p className="text-xs text-green-600 mt-0.5">BCBA-level indirect tasks</p>
                </button>
                <button onClick={() => handleHourTypeChange("restricted")}
                  className={`text-left border-2 rounded-xl p-4 transition-all ${form.hour_type === "restricted" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
                  <p className="text-sm font-bold text-blue-700">Restricted (max {req.restricted_max_pct}%)</p>
                  <p className="text-xs text-blue-600 mt-0.5">Direct therapy with clients</p>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Activity Type *</label>
                  <select value={form.activity_type} onChange={(e) => setForm({ ...form, activity_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select activity...</option>
                    <optgroup label={`Unrestricted Activities (min ${req.unrestricted_min_pct}%)`}>
                      {UNRESTRICTED_ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
                    </optgroup>
                    <optgroup label={`Restricted Activities (max ${req.restricted_max_pct}%)`}>
                      {RESTRICTED_ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Client * (required for fieldwork)</label>
                  <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select client...</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Hours *</label>
                  <input type="number" min={0.25} step={0.25} value={form.hours}
                    onChange={(e) => setForm({ ...form, hours: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
                  <input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Supervising BCBA</label>
                  <select value={form.supervisor_id} onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select supervisor...</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Describe activities completed..." rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.push_to_session}
                    onChange={(e) => setForm({ ...form, push_to_session: e.target.checked })} />
                  Push notes to session log
                </label>
              </div>

              <div className="mt-3">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Your Signature (electronic)
                </label>
                <input type="text" value={form.student_signature}
                  onChange={(e) => setForm({ ...form, student_signature: e.target.value })}
                  placeholder="Type your full legal name to sign"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <p className="text-xs text-gray-400 mt-1">
                  By typing your name, you certify these hours are accurate and comply with BACB requirements.
                </p>
              </div>

              {DOES_NOT_COUNT.some((d) => form.activity_type?.toLowerCase().includes(d.toLowerCase().slice(0, 10))) && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  ⚠️ This activity type may not count toward BACB fieldwork hours.
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button onClick={handleSave} loading={saving}>Log Hours</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </Section>
          )}

          {!loading && entries.length > 0 && (
            <div className="flex gap-3 items-center">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">All Hours</option>
                <option value="unrestricted">Unrestricted Only</option>
                <option value="restricted">Restricted Only</option>
              </select>
              <p className="text-sm text-gray-400">
                {filtered.length} entries · {filtered.reduce((a, b) => a + b.hours, 0).toFixed(1)}h
              </p>
            </div>
          )}

          {loading && <p className="text-gray-400 text-sm">Loading...</p>}
          {!loading && filtered.length === 0 && (
            <Section title="Hour Log">
              <p className="text-gray-400 text-sm">No hours logged yet. Click &quot;+ Log Hours&quot; to get started.</p>
            </Section>
          )}

          <div className="space-y-2">
            {filtered.map((entry) => (
              <div key={entry.id} className={`border rounded-xl p-4 bg-white flex justify-between items-start ${entry.approved ? "border-green-200" : entry.hour_type === "unrestricted" ? "border-green-100" : "border-blue-100"}`}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.hour_type === "unrestricted" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {entry.hour_type === "unrestricted" ? "Unrestricted" : "Restricted"}
                    </span>
                    <p className="text-sm font-medium text-gray-800">{entry.activity_type}</p>
                    {entry.approved && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">✓ Approved</span>}
                    {entry.student_signed && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">✓ Signed</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {entry.session_date}
                    {entry.supervisor_id && ` · ${profileMap.get(entry.supervisor_id)}`}
                    {entry.client_id && ` · ${clientMap.get(entry.client_id)}`}
                  </p>
                  {entry.notes && <p className="text-xs text-gray-500 mt-1">{entry.notes}</p>}
                  {!entry.student_signed && (
                    <button onClick={() => studentSignEntry(entry.id)} className="text-xs text-orange-600 hover:underline mt-1">
                      ✍️ Sign this entry
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-blue-600">{entry.hours}h</span>
                  <button onClick={() => handleDelete(entry.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MVF TAB */}
      {activeTab === "mvf" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            📋 Monthly Verification Forms (MVF) are required by the BACB to document your supervised fieldwork experience. Both you and your supervisor must sign each MVF.
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setShowMVFForm(s => !s)}>
              {showMVFForm ? "✕ Cancel" : "+ Create MVF"}
            </Button>
          </div>

          {showMVFForm && (
            <Section title="Create Monthly Verification Form">
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Month *</label>
                    <select value={mvfMonth} onChange={e => setMvfMonth(parseInt(e.target.value))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Year *</label>
                    <input type="number" value={mvfYear} onChange={e => setMvfYear(parseInt(e.target.value))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Supervisor *</label>
                    <select value={mvfSupervisorId} onChange={e => setMvfSupervisorId(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">Select supervisor...</option>
                      {profiles.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Experience Type</label>
                  <div className="flex gap-2">
                    {[
                      { value: "concentrated", label: "Concentrated", desc: "One supervisor, one area" },
                      { value: "diversified", label: "Diversified", desc: "Multiple supervisors/areas" },
                    ].map(opt => (
                      <button key={opt.value} type="button" onClick={() => setExpType(opt.value)}
                        className={`flex-1 border rounded-xl p-3 text-left transition-all ${expType === opt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
                        <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                        <p className="text-xs text-gray-400">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">BACB Task List Areas Covered</label>
                  <div className="flex flex-wrap gap-2">
                    {BACB_TASKS.map(task => (
                      <button key={task} type="button" onClick={() => toggleTask(task)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedTasks.includes(task) ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                        {task}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-700">Hours for {MONTHS[mvfMonth - 1]} {mvfYear}:</p>
                  {(() => {
                    const monthHours = entries.filter(h => {
                      const d = new Date(h.session_date);
                      return d.getMonth() + 1 === mvfMonth && d.getFullYear() === mvfYear;
                    });
                    const total = monthHours.reduce((sum, h) => sum + h.hours, 0);
                    const sup = monthHours.filter(h => h.hour_type === "restricted").reduce((sum, h) => sum + h.hours, 0);
                    return (
                      <>
                        <p>Total: <strong>{total}h</strong></p>
                        <p>Supervised (Restricted): <strong>{sup}h</strong></p>
                        <p>Independent (Unrestricted): <strong>{(total - sup).toFixed(1)}h</strong></p>
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                  <textarea value={mvfNotes} onChange={e => setMvfNotes(e.target.value)}
                    placeholder="Additional notes for this month..."
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Your Signature *</label>
                  <input type="text" value={mvfStudentSig} onChange={e => setMvfStudentSig(e.target.value)}
                    placeholder="Type your full legal name to sign"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <p className="text-xs text-gray-400 mt-1">
                    By signing, you certify that the information on this MVF is accurate per BACB requirements.
                  </p>
                </div>

                <Button onClick={handleCreateMVF} loading={savingMVF} disabled={!mvfMonth || !mvfYear}>
                  Create MVF
                </Button>
              </div>
            </Section>
          )}

          {mvfs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm">No MVFs created yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mvfs.map(mvf => (
                <div key={mvf.id} className="border border-gray-100 rounded-2xl p-5 bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{MONTHS[mvf.month - 1]} {mvf.year}</p>
                      <p className="text-xs text-gray-400">{mvf.experience_type} experience</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[mvf.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {mvf.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { label: "Total", value: `${mvf.total_hours}h` },
                      { label: "Supervised", value: `${mvf.supervised_hours}h` },
                      { label: "Independent", value: `${mvf.independent_hours}h` },
                    ].map(stat => (
                      <div key={stat.label} className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{stat.value}</p>
                        <p className="text-xs text-gray-400">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  {mvf.tasks_completed && mvf.tasks_completed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {mvf.tasks_completed.map(task => (
                        <span key={task} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{task}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-4 text-xs border-t pt-3">
                    {mvf.student_signature ? (
                      <span className="text-green-600">✓ Student signed {mvf.student_signed_at ? new Date(mvf.student_signed_at).toLocaleDateString() : ""}</span>
                    ) : (
                      <button onClick={() => studentSignMVF(mvf.id)} className="text-orange-600 hover:underline">✍️ Sign MVF</button>
                    )}
                    {mvf.supervisor_signature ? (
                      <span className="text-blue-600">✓ Supervisor signed {mvf.supervisor_signed_at ? new Date(mvf.supervisor_signed_at).toLocaleDateString() : ""}</span>
                    ) : (
                      <span className="text-gray-400">⏳ Awaiting supervisor signature</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACTIVITY REFERENCE TAB */}
      {activeTab === "activities" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title={`✅ Unrestricted Activities (min ${req.unrestricted_min_pct}%)`}>
            <p className="text-xs text-gray-500 mb-3">BCBA-level indirect tasks</p>
            <div className="space-y-1">
              {UNRESTRICTED_ACTIVITIES.map((a) => (
                <div key={a} className="flex items-center gap-2 text-xs text-gray-700 py-1 border-b border-gray-50">
                  <span className="text-green-500 font-bold shrink-0">✓</span> {a}
                </div>
              ))}
            </div>
          </Section>
          <div className="space-y-4">
            <Section title={`🔵 Restricted Activities (max ${req.restricted_max_pct}%)`}>
              <p className="text-xs text-gray-500 mb-3">Direct therapy with clients</p>
              <div className="space-y-1">
                {RESTRICTED_ACTIVITIES.map((a) => (
                  <div key={a} className="flex items-center gap-2 text-xs text-gray-700 py-1 border-b border-gray-50">
                    <span className="text-blue-500 font-bold shrink-0">•</span> {a}
                  </div>
                ))}
              </div>
            </Section>
            <Section title="❌ Does NOT Count">
              <p className="text-xs text-gray-500 mb-3">Per BACB guidelines</p>
              <div className="space-y-1">
                {DOES_NOT_COUNT.map((a) => (
                  <div key={a} className="flex items-center gap-2 text-xs text-gray-500 py-1 border-b border-gray-50">
                    <span className="text-red-400 font-bold shrink-0">✕</span> {a}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      )}

      {/* REQUIREMENTS TAB */}
      {activeTab === "requirements" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="BCBA Fieldwork Requirements">
              <div className="space-y-3 text-sm">
                {[
                  { label: "Total Hours Required", value: "2,000 hours" },
                  { label: "Unrestricted (minimum)", value: "60% = 1,200+ hours" },
                  { label: "Restricted (maximum)", value: "40% = up to 800 hours" },
                  { label: "Supervisor Requirement", value: "BCBA with active cert" },
                  { label: "Client Requirement", value: "All hours must be client-specific" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-bold text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="BCaBA Fieldwork Requirements">
              <div className="space-y-3 text-sm">
                {[
                  { label: "Total Hours Required", value: "1,000 hours" },
                  { label: "Unrestricted (minimum)", value: "40% = 400+ hours" },
                  { label: "Restricted (maximum)", value: "60% = up to 600 hours" },
                  { label: "Supervisor Requirement", value: "BCBA or BCaBA" },
                  { label: "Client Requirement", value: "All hours must be client-specific" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-bold text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
          <Section title="Important BACB Rules">
            <div className="space-y-3">
              {[
                { rule: "All fieldwork must be behavior-analytic in nature", type: "required" },
                { rule: "All tasks must be tied to a specific, real-world client", type: "required" },
                { rule: "Supervisor must be present or available during restricted hours", type: "required" },
                { rule: "Coursework, studying for exam, CPR training do NOT count", type: "warning" },
                { rule: "Hypothetical or generic tasks not tied to a client do NOT count", type: "warning" },
                { rule: "Attending conferences or ACE events do NOT count", type: "warning" },
              ].map((item) => (
                <div key={item.rule} className={`flex items-start gap-3 border rounded-lg p-3 text-sm ${item.type === "required" ? "border-blue-100 bg-blue-50" : "border-orange-100 bg-orange-50"}`}>
                  <span className={`font-bold shrink-0 ${item.type === "required" ? "text-blue-500" : "text-orange-500"}`}>
                    {item.type === "required" ? "✓" : "⚠️"}
                  </span>
                  <p className={item.type === "required" ? "text-blue-700" : "text-orange-700"}>{item.rule}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Source: BACB Fieldwork Checklist ·
              <a href="https://www.bacb.com/wp-content/uploads/2020/05/Fieldwork-Checklist-and-Tip-Sheet-260129-a.pdf"
                target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">
                Download Official PDF →
              </a>
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}