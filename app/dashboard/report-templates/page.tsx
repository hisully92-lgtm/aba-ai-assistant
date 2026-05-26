"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Template = {
  id: string;
  name: string;
  type: string;
  content: Record<string, string>;
  is_default: boolean;
  created_at: string;
};

const TEMPLATE_TYPES = ["Session Note", "Progress Report", "Behavior Incident", "SOAP Note", "Parent Summary", "Discharge Summary"];

const DEFAULT_TEMPLATES = [
  {
    name: "Standard ABA Session Note",
    type: "Session Note",
    content: {
      header: "ABA Therapy Session Note",
      sections: "Client Response | Programs Targeted | Behaviors Observed | Interventions Used | Plan for Next Session",
      footer: "Provider Signature | Date | Supervisor Review",
    },
  },
  {
    name: "SOAP Progress Note",
    type: "SOAP Note",
    content: {
      S: "Subjective: Caregiver report, client mood, any concerns noted",
      O: "Objective: Data collected, behaviors observed, programs run",
      A: "Assessment: Progress toward goals, clinical interpretation",
      P: "Plan: Next session targets, modifications, recommendations",
    },
  },
  {
    name: "Monthly Progress Report",
    type: "Progress Report",
    content: {
      header: "Monthly ABA Progress Report",
      summary: "Client progress summary for the reporting period",
      behaviors: "Behavior reduction goal progress",
      skills: "Skill acquisition goal progress",
      recommendations: "Clinical recommendations and plan",
    },
  },
  {
    name: "Parent/Caregiver Summary",
    type: "Parent Summary",
    content: {
      greeting: "Dear [Caregiver Name],",
      skills: "Skills your child worked on this week",
      progress: "Progress highlights",
      homework: "Home practice activities",
      nextSession: "What to expect next session",
    },
  },
];

export default function ReportTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [sections, setSections] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("report_templates").select("*").eq("created_by", user.id).order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      await seedDefaults(user.id);
    } else {
      setTemplates(data.map((t: any) => ({ ...t, content: typeof t.content === "object" ? t.content : JSON.parse(t.content || "{}") })));
    }
    setLoading(false);
  }

  async function seedDefaults(userId: string) {
    const { data } = await supabase.from("report_templates").insert(
      DEFAULT_TEMPLATES.map((t) => ({ ...t, content: t.content, is_default: true, created_by: userId }))
    ).select();
    setTemplates((data ?? []).map((t: any) => ({ ...t, content: typeof t.content === "object" ? t.content : JSON.parse(t.content || "{}") })));
  }

  function addSection() { setSections((prev) => [...prev, { key: "", value: "" }]); }
  function removeSection(i: number) { setSections((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateSection(i: number, field: "key" | "value", val: string) {
    setSections((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  async function handleSave() {
    if (!name || !type) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const content = Object.fromEntries(sections.filter((s) => s.key).map((s) => [s.key, s.value]));

    if (editingId) {
      const { data } = await supabase.from("report_templates").update({ name, type, content }).eq("id", editingId).select().single();
      if (data) setTemplates((prev) => prev.map((t) => t.id === editingId ? { ...data, content } : t));
    } else {
      const { data } = await supabase.from("report_templates").insert([{ name, type, content, is_default: false, created_by: user.id }]).select().single();
      if (data) setTemplates((prev) => [{ ...data, content }, ...prev]);
    }

    setShowForm(false);
    setName(""); setType(""); setSections([{ key: "", value: "" }]); setEditingId(null);
    setSaving(false);
  }

  function handleEdit(template: Template) {
    setName(template.name);
    setType(template.type);
    setSections(Object.entries(template.content).map(([key, value]) => ({ key, value })));
    setEditingId(template.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    await supabase.from("report_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  function typeColor(type: string) {
    const colors: Record<string, string> = {
      "Session Note": "bg-blue-100 text-blue-700",
      "Progress Report": "bg-purple-100 text-purple-700",
      "SOAP Note": "bg-green-100 text-green-700",
      "Parent Summary": "bg-pink-100 text-pink-700",
      "Behavior Incident": "bg-red-100 text-red-700",
      "Discharge Summary": "bg-gray-100 text-gray-700",
    };
    return colors[type] ?? "bg-gray-100 text-gray-600";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Report Templates">
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setName(""); setType(""); setSections([{ key: "", value: "" }]); }}>
          {showForm ? "Cancel" : "+ New Template"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section title={editingId ? "Edit Template" : "New Report Template"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Template Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Session Note Template"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Template Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select type...</option>
                {TEMPLATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">Sections</label>
              <Button variant="outline" onClick={addSection}>+ Add Section</Button>
            </div>
            {sections.map((s, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 items-start">
                <input type="text" value={s.key} onChange={(e) => updateSection(i, "key", e.target.value)}
                  placeholder="Section name (e.g. Objective)"
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <textarea value={s.value} onChange={(e) => updateSection(i, "value", e.target.value)}
                  placeholder="Default content or instructions..."
                  rows={2} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <button onClick={() => removeSection(i)} className="text-red-400 hover:text-red-600 text-xs pt-2">Remove</button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving}>Save Template</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
          </div>
        </Section>
      )}

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((t) => {
          const isExpanded = expandedId === t.id;
          return (
            <div key={t.id} className="border border-gray-100 rounded-xl bg-white">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{t.name}</p>
                      {t.is_default && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Default</span>}
                    </div>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${typeColor(t.type)}`}>{t.type}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className="text-xs text-gray-400 hover:text-gray-600">{isExpanded ? "▲" : "▼"}</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                    {Object.entries(t.content).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{key}</p>
                        <p className="text-sm text-gray-700 mt-0.5">{value}</p>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" onClick={() => handleEdit(t)}>Edit</Button>
                      {!t.is_default && (
                        <Button variant="danger" onClick={() => handleDelete(t.id)}>Delete</Button>
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