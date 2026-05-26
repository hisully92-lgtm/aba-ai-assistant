"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import jsPDF from "jspdf";

type Client = { id: string; full_name: string };
type Incident = {
  id: string;
  client_id: string;
  incident_type: string;
  severity: string;
  description: string;
  antecedent: string;
  behavior: string;
  consequence: string;
  injuries: string;
  witnesses: string;
  immediate_actions: string;
  follow_up_required: boolean;
  follow_up_notes: string;
  reported_to: string;
  incident_date: string;
  incident_time: string;
  location: string;
  created_at: string;
};

const INCIDENT_TYPES = [
  "Aggressive behavior toward others",
  "Self-injurious behavior",
  "Elopement / Running away",
  "Property destruction",
  "Fall / Physical injury",
  "Medical emergency",
  "Restraint / Physical intervention",
  "Verbal aggression",
  "Seizure",
  "Allergic reaction",
  "Other",
];

const SEVERITIES = [
  { value: "minor", label: "Minor", color: "bg-yellow-100 text-yellow-700" },
  { value: "moderate", label: "Moderate", color: "bg-orange-100 text-orange-700" },
  { value: "serious", label: "Serious", color: "bg-red-100 text-red-700" },
  { value: "critical", label: "Critical", color: "bg-red-200 text-red-800" },
];

const emptyForm = {
  client_id: "",
  incident_type: "",
  severity: "minor",
  description: "",
  antecedent: "",
  behavior: "",
  consequence: "",
  injuries: "",
  witnesses: "",
  immediate_actions: "",
  follow_up_required: false,
  follow_up_notes: "",
  reported_to: "",
  incident_date: new Date().toISOString().split("T")[0],
  incident_time: new Date().toTimeString().slice(0, 5),
  location: "",
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: incidentData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("incident_reports").select("*").eq("created_by", user.id).order("incident_date", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setIncidents(incidentData ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.client_id || !form.incident_type) {
      setError("Client and incident type are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error: saveError } = await supabase
      .from("incident_reports")
      .insert([{ ...form, created_by: user.id }])
      .select()
      .single();

    if (saveError) { setError(saveError.message); setSaving(false); return; }

    setIncidents((prev) => [data, ...prev]);
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  function exportPDF(incident: Incident) {
    const client = clients.find((c) => c.id === incident.client_id);
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("INCIDENT / ACCIDENT REPORT", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text("CONFIDENTIAL — ABA AI Assistant", 105, 28, { align: "center" });
    doc.line(20, 32, 190, 32);

    let y = 42;
    const field = (label: string, value: string) => {
      if (!value) return;
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 20, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(value, 140);
      doc.text(lines, 65, y);
      y += Math.max(8, lines.length * 6);
    };

    field("Client", client?.full_name ?? "Unknown");
    field("Date", incident.incident_date);
    field("Time", incident.incident_time);
    field("Location", incident.location);
    field("Incident Type", incident.incident_type);
    field("Severity", incident.severity.toUpperCase());
    y += 4; doc.line(20, y, 190, y); y += 6;
    field("Description", incident.description);
    field("Antecedent (A)", incident.antecedent);
    field("Behavior (B)", incident.behavior);
    field("Consequence (C)", incident.consequence);
    field("Injuries", incident.injuries || "None reported");
    field("Witnesses", incident.witnesses || "None");
    field("Immediate Actions", incident.immediate_actions);
    field("Reported To", incident.reported_to);
    if (incident.follow_up_required) {
      field("Follow-Up Required", "YES");
      field("Follow-Up Notes", incident.follow_up_notes);
    }

    y += 20;
    doc.text("Staff Signature: ________________________  Date: __________", 20, y);

    doc.save(`incident-${client?.full_name?.replace(/\s/g, "-")}-${incident.incident_date}.pdf`);
  }

  let filtered = incidents;
  if (filterClient) filtered = filtered.filter((i) => i.client_id === filterClient);
  if (filterSeverity) filtered = filtered.filter((i) => i.severity === filterSeverity);

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  function severityColor(severity: string) {
    return SEVERITIES.find((s) => s.value === severity)?.color ?? "bg-gray-100 text-gray-600";
  }

  const seriousCount = incidents.filter((i) => i.severity === "serious" || i.severity === "critical").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Incident Reports">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ File Incident Report"}
        </Button>
      </PageHeader>

      {seriousCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700">🚨 {seriousCount} serious/critical incident{seriousCount > 1 ? "s" : ""} on record — ensure follow-up is documented.</p>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SEVERITIES.map((s) => (
          <div key={s.value} className="border rounded-lg p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${s.color.replace("bg-", "text-").split(" ")[0]}`}>
              {incidents.filter((i) => i.severity === s.value).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <Section title="File Incident Report">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Basic Information</p>
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Incident Type *</label>
              <select value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select type...</option>
                {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date</label>
              <input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Time</label>
              <input type="time" value={form.incident_time} onChange={(e) => setForm({ ...form, incident_time: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Clinic room 3, Client home" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Severity</label>
              <div className="flex gap-2">
                {SEVERITIES.map((s) => (
                  <button key={s.value} onClick={() => setForm({ ...form, severity: s.value })}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${form.severity === s.value ? s.color + " border-current" : "border-gray-200 text-gray-500"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">ABC Description</p>
          <div className="grid grid-cols-1 gap-3 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Full Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe what happened in detail..." rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Antecedent (A)</label>
                <textarea value={form.antecedent} onChange={(e) => setForm({ ...form, antecedent: e.target.value })}
                  placeholder="What happened before?" rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Behavior (B)</label>
                <textarea value={form.behavior} onChange={(e) => setForm({ ...form, behavior: e.target.value })}
                  placeholder="Exact behavior observed?" rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Consequence (C)</label>
                <textarea value={form.consequence} onChange={(e) => setForm({ ...form, consequence: e.target.value })}
                  placeholder="What happened after?" rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Response & Follow-Up</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Injuries / Medical</label>
              <textarea value={form.injuries} onChange={(e) => setForm({ ...form, injuries: e.target.value })}
                placeholder="Any injuries? Medical attention required?" rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Immediate Actions Taken</label>
              <textarea value={form.immediate_actions} onChange={(e) => setForm({ ...form, immediate_actions: e.target.value })}
                placeholder="What did staff do immediately?" rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Witnesses</label>
              <input type="text" value={form.witnesses} onChange={(e) => setForm({ ...form, witnesses: e.target.value })}
                placeholder="Names of witnesses" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reported To</label>
              <input type="text" value={form.reported_to} onChange={(e) => setForm({ ...form, reported_to: e.target.value })}
                placeholder="Supervisor, parent, admin..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setForm({ ...form, follow_up_required: !form.follow_up_required })}
                  className={`w-10 h-6 rounded-full transition-all relative ${form.follow_up_required ? "bg-blue-500" : "bg-gray-300"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${form.follow_up_required ? "left-5" : "left-1"}`} />
                </button>
                <label className="text-sm font-medium text-gray-700">Follow-up Required</label>
              </div>
              {form.follow_up_required && (
                <textarea value={form.follow_up_notes} onChange={(e) => setForm({ ...form, follow_up_notes: e.target.value })}
                  placeholder="Describe required follow-up actions..." rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving}>File Report</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTERS */}
      {!loading && incidents.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Severities</option>
            {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} reports</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Incident Reports">
          <p className="text-gray-400 text-sm">No incident reports filed yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((incident) => {
          const isExpanded = expandedId === incident.id;
          return (
            <div key={incident.id} className={`border rounded-xl bg-white ${incident.severity === "critical" ? "border-red-300" : incident.severity === "serious" ? "border-red-200" : "border-gray-100"}`}>
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{clientMap.get(incident.client_id) ?? "Unknown"}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColor(incident.severity)}`}>
                        {incident.severity}
                      </span>
                      {incident.follow_up_required && (
                        <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">⚠️ Follow-up needed</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {incident.incident_type} · {incident.incident_date} {incident.incident_time}
                      {incident.location && ` · ${incident.location}`}
                    </p>
                    {incident.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{incident.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" onClick={() => exportPDF(incident)}>📄 PDF</Button>
                    <button onClick={() => setExpandedId(isExpanded ? null : incident.id)}
                      className="text-xs text-gray-400 hover:text-gray-600">{isExpanded ? "▲" : "▼"}</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    {incident.antecedent && <div><p className="text-xs font-semibold text-gray-500 mb-1">Antecedent</p><p className="text-gray-700">{incident.antecedent}</p></div>}
                    {incident.behavior && <div><p className="text-xs font-semibold text-gray-500 mb-1">Behavior</p><p className="text-gray-700">{incident.behavior}</p></div>}
                    {incident.consequence && <div><p className="text-xs font-semibold text-gray-500 mb-1">Consequence</p><p className="text-gray-700">{incident.consequence}</p></div>}
                    {incident.injuries && <div><p className="text-xs font-semibold text-gray-500 mb-1">Injuries</p><p className="text-gray-700">{incident.injuries}</p></div>}
                    {incident.immediate_actions && <div><p className="text-xs font-semibold text-gray-500 mb-1">Immediate Actions</p><p className="text-gray-700">{incident.immediate_actions}</p></div>}
                    {incident.reported_to && <div><p className="text-xs font-semibold text-gray-500 mb-1">Reported To</p><p className="text-gray-700">{incident.reported_to}</p></div>}
                    {incident.witnesses && <div><p className="text-xs font-semibold text-gray-500 mb-1">Witnesses</p><p className="text-gray-700">{incident.witnesses}</p></div>}
                    {incident.follow_up_notes && <div className="md:col-span-3"><p className="text-xs font-semibold text-gray-500 mb-1">Follow-up Notes</p><p className="text-gray-700">{incident.follow_up_notes}</p></div>}
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
