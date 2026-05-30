"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Session = {
  id: string;
  client_id: string;
  date: string;
  status: string;
  behaviors_observed: string;
  interventions_used: string;
  client_response: string;
  programs_targeted: string;
  notes: string;
  staff_member: string;
  created_at: string;
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

export default function SessionsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  // Form state
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("completed");
  const [clientResponse, setClientResponse] = useState("");
  const [notes, setNotes] = useState("");
  const [staffMember, setStaffMember] = useState("");
  const [selectedBehaviors, setSelectedBehaviors] = useState<string[]>([]);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [showSOAP, setShowSOAP] = useState(false);
  const [soap, setSoap] = useState({ subjective: "", objective: "", assessment: "", plan: "" });

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (timerRunning) {
      const interval = setInterval(() => setTimerSeconds(s => s + 1), 1000);
      setTimerInterval(interval);
      return () => clearInterval(interval);
    } else {
      if (timerInterval) clearInterval(timerInterval);
    }
  }, [timerRunning]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: sessionData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("sessions").select("*").eq("created_by", user.id).order("created_at", { ascending: false }).limit(50),
    ]);

    setClients(clientData ?? []);
    setSessions(sessionData ?? []);
    setLoading(false);
  }

  function toggleItem(item: string, list: string[], setList: (l: string[]) => void) {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  }

  function formatTimer(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function startTimer() {
    setTimerSeconds(0);
    setTimerRunning(true);
  }

  function stopTimer() {
    setTimerRunning(false);
    if (soap.objective === "") {
      setSoap(prev => ({ ...prev, objective: `Session duration: ${formatTimer(timerSeconds)}` }));
    }
  }

  function resetForm() {
    setClientId(""); setDate(new Date().toISOString().split("T")[0]);
    setStatus("completed"); setClientResponse(""); setNotes(""); setStaffMember("");
    setSelectedBehaviors([]); setSelectedInterventions([]); setSelectedPrograms([]);
    setSoap({ subjective: "", objective: "", assessment: "", plan: "" });
    setTimerRunning(false); setTimerSeconds(0);
    setShowForm(false);
  }

  async function handleSave() {
    if (!clientId) { setError("Please select a client."); return; }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase.from("sessions").insert([{
      client_id: clientId,
      date,
      status,
      client_response: clientResponse,
      notes,
      staff_member: staffMember,
      behaviors_observed: selectedBehaviors.join(", "),
      interventions_used: selectedInterventions.join(", "),
      programs_targeted: selectedPrograms.join(", "),
      soap_subjective: soap.subjective,
      soap_objective: soap.objective || (timerSeconds > 0 ? `Session duration: ${formatTimer(timerSeconds)}` : ""),
      soap_assessment: soap.assessment,
      soap_plan: soap.plan,
      created_by: user.id,
    }]).select().single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }
    if (data) setSessions(prev => [data, ...prev]);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    resetForm();
    setSaving(false);
  }

  const clientMap = new Map(clients.map(c => [c.id, c.full_name]));
  const filtered = sessions
    .filter(s => filterClient ? s.client_id === filterClient : true)
    .filter(s => filterStatus ? s.status === filterStatus : true);

  return (
    <div className="space-y-6">
      <PageHeader title="Session Notes">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Session"}
        </Button>
      </PageHeader>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Session note saved successfully.
        </div>
      )}

      {showForm && (
        <Section title="New Session Note">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {/* SESSION TIMER */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Session Timer</p>
            <div className="flex items-center gap-4">
              <p className={`text-3xl font-mono font-bold ${timerRunning ? "text-blue-600" : "text-gray-400"}`}>
                {formatTimer(timerSeconds)}
              </p>
              <div className="flex gap-2">
                {!timerRunning ? (
                  <Button onClick={startTimer}>Start Timer</Button>
                ) : (
                  <Button variant="danger" onClick={stopTimer}>Stop Timer</Button>
                )}
                <Button variant="outline" onClick={() => { setTimerRunning(false); setTimerSeconds(0); }}>Reset</Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client Response</label>
              <select value={clientResponse} onChange={e => setClientResponse(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select response...</option>
                {CLIENT_RESPONSES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Staff Member</label>
              <input type="text" value={staffMember} onChange={e => setStaffMember(e.target.value)}
                placeholder="Staff name and role"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Behaviors Observed</label>
              <div className="flex flex-wrap gap-2">
                {BEHAVIORS_LIST.map(b => (
                  <button key={b} onClick={() => toggleItem(b, selectedBehaviors, setSelectedBehaviors)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedBehaviors.includes(b) ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-300 hover:border-red-300"}`}>
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Interventions Used</label>
              <div className="flex flex-wrap gap-2">
                {INTERVENTIONS_LIST.map(i => (
                  <button key={i} onClick={() => toggleItem(i, selectedInterventions, setSelectedInterventions)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedInterventions.includes(i) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"}`}>
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Programs Targeted</label>
              <div className="flex flex-wrap gap-2">
                {PROGRAMS_LIST.map(p => (
                  <button key={p} onClick={() => toggleItem(p, selectedPrograms, setSelectedPrograms)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${selectedPrograms.includes(p) ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-300 hover:border-purple-300"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Session Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Additional session notes..." rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            <div className="md:col-span-2">
              <button onClick={() => setShowSOAP(!showSOAP)}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                <span>{showSOAP ? "▼" : "▶"}</span>
                SOAP Notes {showSOAP ? "(hide)" : "(optional)"}
              </button>
            </div>

            {showSOAP && (
              <div className="md:col-span-2 space-y-3 border border-blue-100 rounded-xl p-4 bg-blue-50">
                <p className="text-xs font-semibold text-blue-700 mb-2">SOAP Note Format</p>
                {[
                  { key: "subjective", label: "S — Subjective", placeholder: "Client/caregiver report, concerns, mood..." },
                  { key: "objective", label: "O — Objective", placeholder: "Measurable data, frequency, duration, observations..." },
                  { key: "assessment", label: "A — Assessment", placeholder: "Clinical interpretation, progress toward goals..." },
                  { key: "plan", label: "P — Plan", placeholder: "Next session plan, goals, modifications..." },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-medium text-gray-600 mb-0.5 block">{field.label}</label>
                    <textarea value={soap[field.key as keyof typeof soap]}
                      onChange={e => setSoap(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder} rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
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

      {/* FILTERS */}
      {!loading && sessions.length > 0 && (
        <div className="flex gap-3 flex-wrap items-center">
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <p className="text-sm text-gray-400">{filtered.length} sessions</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      <div className="space-y-3">
        {filtered.map(session => (
          <div key={session.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-gray-800">{clientMap.get(session.client_id) ?? "Unknown"}</p>
                <p className="text-xs text-gray-400 mt-0.5">{session.date ?? new Date(session.created_at).toLocaleDateString()}</p>
                {session.behaviors_observed && (
                  <p className="text-xs text-gray-500 mt-1">Behaviors: {session.behaviors_observed}</p>
                )}
                {session.programs_targeted && (
                  <p className="text-xs text-gray-500">Programs: {session.programs_targeted}</p>
                )}
                {session.staff_member && (
                  <p className="text-xs text-gray-400 mt-1">Staff: {session.staff_member}</p>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ml-3 ${
                session.status === "completed" ? "bg-green-100 text-green-700"
                : session.status === "pending" ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-600"
              }`}>
                {session.status}
              </span>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-gray-400 text-sm">No sessions found.</p>
        )}
      </div>
    </div>
  );
}