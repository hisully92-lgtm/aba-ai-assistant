"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Assessment = {
  id: string;
  client_id: string;
  assessment_type: string;
  scores: Record<string, number>;
  total_score: number;
  level: string;
  notes: string;
  assessed_by: string;
  assessment_date: string;
  created_at: string;
};

const VB_MAPP_DOMAINS = [
  { key: "mand", label: "Mand", maxScore: 15 },
  { key: "tact", label: "Tact", maxScore: 15 },
  { key: "listener_responding", label: "Listener Responding", maxScore: 15 },
  { key: "visual_perceptual", label: "Visual Perceptual / Matching", maxScore: 15 },
  { key: "independent_play", label: "Independent Play", maxScore: 15 },
  { key: "social_behavior", label: "Social Behavior / Play", maxScore: 15 },
  { key: "motor_imitation", label: "Motor Imitation", maxScore: 15 },
  { key: "echoic", label: "Echoic", maxScore: 15 },
  { key: "reader", label: "Reader", maxScore: 15 },
  { key: "writer", label: "Writer", maxScore: 15 },
  { key: "math", label: "Math", maxScore: 15 },
  { key: "lrffc", label: "LRFFC", maxScore: 15 },
  { key: "intraverbal", label: "Intraverbal", maxScore: 15 },
  { key: "group_discussion", label: "Group & Classroom Skills", maxScore: 15 },
  { key: "linguistic_structure", label: "Linguistic Structure", maxScore: 15 },
];

const ABLLS_DOMAINS = [
  { key: "cooperation", label: "Cooperation & Reinforcer Effectiveness", maxScore: 25 },
  { key: "visual_performance", label: "Visual Performance", maxScore: 58 },
  { key: "receptive_language", label: "Receptive Language", maxScore: 68 },
  { key: "motor_imitation", label: "Motor Imitation", maxScore: 36 },
  { key: "vocal_imitation", label: "Vocal Imitation", maxScore: 26 },
  { key: "requests", label: "Requests", maxScore: 60 },
  { key: "labeling", label: "Labeling", maxScore: 101 },
  { key: "intraverbals", label: "Intraverbals", maxScore: 84 },
  { key: "self_care", label: "Self-Care", maxScore: 53 },
  { key: "social_interaction", label: "Social Interaction", maxScore: 30 },
  { key: "group_instruction", label: "Group Instruction", maxScore: 24 },
  { key: "classroom_routines", label: "Classroom Routines", maxScore: 24 },
  { key: "generalized_responding", label: "Generalized Responding", maxScore: 10 },
  { key: "reading", label: "Reading", maxScore: 48 },
  { key: "math", label: "Math", maxScore: 30 },
  { key: "writing", label: "Writing", maxScore: 24 },
  { key: "spelling", label: "Spelling", maxScore: 14 },
];

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClient, setFilterClient] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [assessmentType, setAssessmentType] = useState("VB-MAPP");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [assessedBy, setAssessedBy] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: assessData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("program_fidelity").select("*").eq("created_by", user.id).order("created_at", { ascending: false }).limit(0),
    ]);

    setClients(clientData ?? []);

    // Load from localStorage as fallback since we don't have a separate assessments table
    const stored = localStorage.getItem("aba_assessments");
    if (stored) setAssessments(JSON.parse(stored));
    setLoading(false);
  }

  function initScores(type: string) {
    const domains = type === "VB-MAPP" ? VB_MAPP_DOMAINS : ABLLS_DOMAINS;
    const initial: Record<string, number> = {};
    domains.forEach((d) => { initial[d.key] = 0; });
    setScores(initial);
  }

  function handleTypeChange(type: string) {
    setAssessmentType(type);
    initScores(type);
  }

  function updateScore(key: string, value: number) {
    setScores((prev) => ({ ...prev, [key]: value }));
  }

  function calculateTotal() {
    return Object.values(scores).reduce((a, b) => a + b, 0);
  }

  function getLevel(total: number, type: string) {
    if (type === "VB-MAPP") {
      if (total <= 45) return "Level 1 (Early Learner)";
      if (total <= 90) return "Level 2 (Intermediate)";
      return "Level 3 (Advanced)";
    }
    return total > 200 ? "Advanced" : total > 100 ? "Intermediate" : "Early";
  }

  async function handleSave() {
    if (!clientId || !assessmentType) return;
    setSaving(true);

    const total = calculateTotal();
    const level = getLevel(total, assessmentType);

    const newAssessment: Assessment = {
      id: crypto.randomUUID(),
      client_id: clientId,
      assessment_type: assessmentType,
      scores,
      total_score: total,
      level,
      notes,
      assessed_by: assessedBy,
      assessment_date: assessmentDate,
      created_at: new Date().toISOString(),
    };

    const updated = [newAssessment, ...assessments];
    setAssessments(updated);
    localStorage.setItem("aba_assessments", JSON.stringify(updated));

    setShowForm(false);
    setClientId(""); setScores({}); setNotes(""); setAssessedBy("");
    setSaving(false);
  }

  const filtered = filterClient ? assessments.filter((a) => a.client_id === filterClient) : assessments;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));
  const domains = assessmentType === "VB-MAPP" ? VB_MAPP_DOMAINS : ABLLS_DOMAINS;

  return (
    <div className="space-y-6">
      <PageHeader title="Assessments">
        <Button onClick={() => { setShowForm(!showForm); if (!showForm) initScores(assessmentType); }}>
          {showForm ? "Cancel" : "+ New Assessment"}
        </Button>
      </PageHeader>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        📋 Supports VB-MAPP and ABLLS-R assessment frameworks with domain-by-domain scoring.
      </div>

      {showForm && (
        <Section title="New Assessment">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Assessment Type</label>
              <div className="flex gap-2">
                {["VB-MAPP", "ABLLS-R"].map((t) => (
                  <button key={t} onClick={() => handleTypeChange(t)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${assessmentType === t ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Assessed By</label>
              <input type="text" value={assessedBy} onChange={(e) => setAssessedBy(e.target.value)}
                placeholder="BCBA name" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Assessment Date</label>
              <input type="date" value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* DOMAIN SCORES */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium text-gray-700">Domain Scores</label>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">{calculateTotal()} pts</p>
                <p className="text-xs text-gray-500">{getLevel(calculateTotal(), assessmentType)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {domains.map((domain) => (
                <div key={domain.key} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-medium text-gray-700">{domain.label}</label>
                    <span className="text-xs text-gray-400">/ {domain.maxScore}</span>
                  </div>
                  <input type="range" min={0} max={domain.maxScore} value={scores[domain.key] ?? 0}
                    onChange={(e) => updateScore(domain.key, parseInt(e.target.value))}
                    className="w-full mb-1" />
                  <div className="flex justify-between items-center">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mr-2">
                      <div className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${((scores[domain.key] ?? 0) / domain.maxScore) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-blue-600 w-8 text-right">{scores[domain.key] ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Clinical observations, recommendations..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={!clientId}>Save Assessment</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && assessments.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} assessments</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Assessments">
          <p className="text-gray-400 text-sm">No assessments yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((a) => {
          const isExpanded = expandedId === a.id;
          const domainList = a.assessment_type === "VB-MAPP" ? VB_MAPP_DOMAINS : ABLLS_DOMAINS;
          return (
            <div key={a.id} className="border border-gray-100 rounded-xl bg-white">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">{clientMap.get(a.client_id) ?? "Unknown"}</p>
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{a.assessment_type}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.assessment_date} · {a.assessed_by && `Assessed by: ${a.assessed_by} · `}{a.level}
                    </p>
                    <p className="text-lg font-bold text-blue-600 mt-1">{a.total_score} pts</p>
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    className="text-xs text-gray-400 hover:text-gray-600">{isExpanded ? "▲" : "▼"}</button>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                      {domainList.map((domain) => {
                        const score = a.scores[domain.key] ?? 0;
                        const pct = Math.round((score / domain.maxScore) * 100);
                        return (
                          <div key={domain.key} className="border border-gray-100 rounded-lg p-2 bg-gray-50">
                            <p className="text-xs text-gray-600">{domain.label}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-medium text-gray-700">{score}/{domain.maxScore}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {a.notes && <p className="text-sm text-gray-600 italic">{a.notes}</p>}
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