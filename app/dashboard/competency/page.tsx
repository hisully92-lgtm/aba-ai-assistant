"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Profile = { id: string; full_name: string | null };
type CompetencyItem = { skill: string; rating: number; notes: string };
type Checklist = {
  id: string;
  user_id: string;
  checklist_name: string;
  items: CompetencyItem[];
  overall_score: number;
  session_date: string;
  notes: string;
  created_at: string;
};

const CHECKLIST_TEMPLATES: Record<string, string[]> = {
  "RBT Competency Assessment": [
    "Measurement — Continuous measurement",
    "Measurement — Discontinuous measurement",
    "Measurement — Permanent product recording",
    "Skill Acquisition — DTT implementation",
    "Skill Acquisition — NET implementation",
    "Skill Acquisition — Prompt hierarchy use",
    "Skill Acquisition — Reinforcement delivery",
    "Behavior Reduction — Antecedent interventions",
    "Behavior Reduction — Consequence interventions",
    "Behavior Reduction — Crisis prevention",
    "Documentation — Accurate data recording",
    "Documentation — Session notes",
    "Professional Conduct — Communication with BCBA",
    "Professional Conduct — Caregiver interactions",
    "Professional Conduct — HIPAA compliance",
  ],
  "BCBA Supervision Competency": [
    "Assessment — Conducting FBAs",
    "Assessment — Writing behavior intervention plans",
    "Treatment Planning — Goal writing",
    "Treatment Planning — Treatment selection",
    "Supervision — RBT training and feedback",
    "Supervision — Competency assessment",
    "Ethics — BACB ethical code adherence",
    "Ethics — Supervision requirements",
    "Documentation — Progress report writing",
    "Communication — Caregiver training",
  ],
  "Crisis Intervention Skills": [
    "De-escalation verbal strategies",
    "Environmental modifications",
    "Safety planning implementation",
    "Physical intervention (if applicable)",
    "Post-crisis debrief protocol",
    "Documentation of incidents",
    "Communication with supervisor",
  ],
};

const RATINGS = [
  { value: 0, label: "Not Observed" },
  { value: 1, label: "Needs Training" },
  { value: 2, label: "Developing" },
  { value: 3, label: "Competent" },
  { value: 4, label: "Proficient" },
];

export default function CompetencyPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterUserId, setFilterUserId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [checklistName, setChecklistName] = useState("");
  const [items, setItems] = useState<CompetencyItem[]>([]);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: profileData }, { data: checklistData }] = await Promise.all([
      supabase.from("profiles").select("id, full_name"),
      supabase.from("competency_checklists").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setProfiles(profileData ?? []);
    setChecklists((checklistData ?? []).map((c: any) => ({ ...c, items: Array.isArray(c.items) ? c.items : JSON.parse(c.items || "[]") })));
    setLoading(false);
  }

  function handleTemplateSelect(name: string) {
    setChecklistName(name);
    const template = CHECKLIST_TEMPLATES[name];
    if (template) {
      setItems(template.map((skill) => ({ skill, rating: 0, notes: "" })));
    }
  }

  function updateRating(index: number, rating: number) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, rating } : item));
  }

  function updateNotes(index: number, notes: string) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, notes } : item));
  }

  function calculateScore() {
    if (!items.length) return 0;
    const maxScore = items.length * 4;
    const totalScore = items.reduce((a, b) => a + b.rating, 0);
    return Math.round((totalScore / maxScore) * 100);
  }

  async function handleSave() {
    if (!userId || !checklistName || items.length === 0) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const score = calculateScore();
    const { data, error } = await supabase.from("competency_checklists").insert([{
      user_id: userId,
      checklist_name: checklistName,
      items: JSON.stringify(items),
      overall_score: score,
      session_date: sessionDate,
      notes,
      created_by: user.id,
    }]).select().single();

    if (!error && data) {
      setChecklists((prev) => [{ ...data, items }, ...prev]);
      setShowForm(false);
      setUserId(""); setChecklistName(""); setItems([]); setNotes("");
    }
    setSaving(false);
  }

  const filtered = filterUserId ? checklists.filter((c) => c.user_id === filterUserId) : checklists;
  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? "Unknown"]));

  function ratingColor(rating: number) {
    if (rating === 4) return "text-green-600";
    if (rating === 3) return "text-blue-600";
    if (rating === 2) return "text-yellow-600";
    if (rating === 1) return "text-red-500";
    return "text-gray-400";
  }

  function scoreColor(score: number) {
    if (score >= 80) return "bg-green-100 text-green-700";
    if (score >= 60) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Competency Checklists">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Assessment"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section title="New Competency Assessment">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Staff Member *</label>
              <select value={userId} onChange={(e) => setUserId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select staff...</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Assessment Template *</label>
              <select value={checklistName} onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select template...</option>
                {Object.keys(CHECKLIST_TEMPLATES).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Assessment Date</label>
              <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Overall Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {items.length > 0 && (
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-gray-700">Skills ({calculateScore()}% proficiency)</p>
                <div className="flex gap-2 text-xs text-gray-500">
                  {RATINGS.map((r) => <span key={r.value}>{r.value}={r.label}</span>)}
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                <div className={`h-2 rounded-full transition-all ${calculateScore() >= 80 ? "bg-green-500" : calculateScore() >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${calculateScore()}%` }} />
              </div>
              {items.map((item, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm text-gray-700 flex-1">{item.skill}</p>
                    <div className="flex gap-1">
                      {RATINGS.map((r) => (
                        <button key={r.value} onClick={() => updateRating(i, r.value)}
                          title={r.label}
                          className={`w-8 h-8 rounded text-xs font-bold border transition-all ${item.rating === r.value ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-500 hover:border-blue-300"}`}>
                          {r.value}
                        </button>
                      ))}
                    </div>
                  </div>
                  {item.rating > 0 && item.rating < 4 && (
                    <input type="text" value={item.notes} onChange={(e) => updateNotes(i, e.target.value)}
                      placeholder="Notes on this skill..."
                      className="mt-2 w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={!userId || !checklistName || items.length === 0}>
              Save Assessment
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* FILTER */}
      {!loading && checklists.length > 0 && (
        <div className="flex gap-3 items-center">
          <select value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">All Staff</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <p className="text-sm text-gray-400">{filtered.length} assessments</p>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="Competency Assessments">
          <p className="text-gray-400 text-sm">No assessments yet.</p>
        </Section>
      )}

      <div className="space-y-3">
        {filtered.map((c) => {
          const isExpanded = expandedId === c.id;
          return (
            <div key={c.id} className="border border-gray-100 rounded-xl bg-white">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{c.checklist_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {profileMap.get(c.user_id)} · {c.session_date}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${scoreColor(c.overall_score)}`}>
                      {c.overall_score}%
                    </span>
                    <button onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      className="text-xs text-gray-400 hover:text-gray-600">
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${c.overall_score >= 80 ? "bg-green-500" : c.overall_score >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${c.overall_score}%` }} />
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                    {c.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">{item.skill}</span>
                        <span className={`text-xs font-medium ${ratingColor(item.rating)}`}>
                          {RATINGS.find((r) => r.value === item.rating)?.label ?? "Unknown"}
                        </span>
                      </div>
                    ))}
                    {c.notes && <p className="text-xs text-gray-500 mt-2 italic">{c.notes}</p>}
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