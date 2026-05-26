"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import jsPDF from "jspdf";

type Client = { id: string; full_name: string };
type StoryPage = { text: string; emoji: string; imageUrl: string };
type Story = {
  id: string;
  client_id: string;
  support_type: string;
  title: string;
  content: { pages: StoryPage[]; scenario: string };
  created_at: string;
};

const SCENARIOS = [
  "Going to the doctor",
  "First day of school",
  "Making a new friend",
  "Waiting my turn",
  "Using calm hands",
  "When I feel angry",
  "When I feel scared",
  "Going to the grocery store",
  "Riding the school bus",
  "Going to a birthday party",
  "Using words to ask for help",
  "Transitioning between activities",
  "Following directions",
  "Sharing with others",
  "Other",
];

const EMOJIS = ["😊", "😢", "😡", "😨", "🤝", "✋", "💬", "🏫", "🏥", "🛒", "🎂", "🚌", "⏰", "🌟", "💪", "🧘", "❤️", "🎯"];

const STORY_TEMPLATES: Record<string, StoryPage[]> = {
  "Going to the doctor": [
    { text: "Sometimes I go to the doctor.", emoji: "🏥", imageUrl: "" },
    { text: "The doctor wants to help me stay healthy.", emoji: "😊", imageUrl: "" },
    { text: "I might sit in a waiting room. I can bring a toy or book.", emoji: "⏰", imageUrl: "" },
    { text: "The doctor may look in my ears and mouth. That's okay.", emoji: "👂", imageUrl: "" },
    { text: "I can tell the doctor if something hurts.", emoji: "💬", imageUrl: "" },
    { text: "After the visit, I can feel proud. I did it!", emoji: "🌟", imageUrl: "" },
  ],
  "Waiting my turn": [
    { text: "Sometimes I have to wait for my turn.", emoji: "⏰", imageUrl: "" },
    { text: "Waiting can feel hard, but I can do it.", emoji: "💪", imageUrl: "" },
    { text: "I can use calm hands while I wait.", emoji: "✋", imageUrl: "" },
    { text: "I can take deep breaths.", emoji: "🧘", imageUrl: "" },
    { text: "When it's my turn, I feel happy!", emoji: "😊", imageUrl: "" },
  ],
  "When I feel angry": [
    { text: "Sometimes I feel angry.", emoji: "😡", imageUrl: "" },
    { text: "Feeling angry is okay. Everyone feels angry sometimes.", emoji: "❤️", imageUrl: "" },
    { text: "When I feel angry, I can stop and take a breath.", emoji: "🧘", imageUrl: "" },
    { text: "I can use my words to say how I feel.", emoji: "💬", imageUrl: "" },
    { text: "I can ask for help from a trusted adult.", emoji: "🤝", imageUrl: "" },
    { text: "After I calm down, I feel better.", emoji: "😊", imageUrl: "" },
  ],
};

export default function SocialStoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewStory, setPreviewStory] = useState<Story | null>(null);
  const [previewPage, setPreviewPage] = useState(0);

  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [scenario, setScenario] = useState("");
  const [pages, setPages] = useState<StoryPage[]>([{ text: "", emoji: "😊", imageUrl: "" }]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: storyData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("visual_supports").select("*").eq("created_by", user.id).eq("support_type", "social_story").order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setStories((storyData ?? []).map((s: any) => ({
      ...s,
      content: typeof s.content === "object" ? s.content : JSON.parse(s.content || "{}"),
    })));
    setLoading(false);
  }

  function handleScenarioSelect(s: string) {
    setScenario(s);
    setTitle(s);
    const template = STORY_TEMPLATES[s];
    if (template) setPages(template);
  }

  async function generateAIStory() {
    if (!scenario) return;
    setGenerating(true);

    const prompt = `Create a simple social story for a child with autism about: "${scenario}".

Write 5-6 short, simple sentences. Each sentence should be on its own page.
Use first-person perspective ("I", "me", "my").
Keep language simple and concrete.
Focus on positive coping strategies and expected behaviors.
End with a positive outcome.

Return ONLY a JSON array like this (no other text):
[
  {"text": "sentence here", "emoji": "😊"},
  {"text": "sentence here", "emoji": "🏥"}
]

Choose appropriate emojis from: 😊 😢 😡 😨 🤝 ✋ 💬 🏫 🏥 🛒 🎂 🚌 ⏰ 🌟 💪 🧘 ❤️ 🎯 👂 👋`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text ?? "[]";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setPages(parsed.map((p: any) => ({ text: p.text, emoji: p.emoji ?? "😊", imageUrl: "" })));
    } catch {
      // fallback to template if AI fails
      const template = STORY_TEMPLATES[scenario];
      if (template) setPages(template);
    }
    setGenerating(false);
  }

  function addPage() { setPages((prev) => [...prev, { text: "", emoji: "😊", imageUrl: "" }]); }
  function removePage(i: number) { setPages((prev) => prev.filter((_, idx) => idx !== i)); }
  function updatePage(i: number, field: keyof StoryPage, value: string) {
    setPages((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  async function handleSave() {
    if (!clientId || !title || pages.filter((p) => p.text).length === 0) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const validPages = pages.filter((p) => p.text.trim());
    const { data } = await supabase.from("visual_supports").insert([{
      client_id: clientId,
      support_type: "social_story",
      title,
      content: { pages: validPages, scenario },
      created_by: user.id,
    }]).select().single();

    if (data) setStories((prev) => [{ ...data, content: { pages: validPages, scenario } }, ...prev]);
    setShowForm(false);
    setClientId(""); setTitle(""); setScenario(""); setPages([{ text: "", emoji: "😊", imageUrl: "" }]);
    setSaving(false);
  }

  function exportPDF(story: Story) {
    const client = clients.find((c) => c.id === story.client_id);
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text(story.title, 105, 25, { align: "center" });
    doc.setFontSize(12);
    doc.text(`A Social Story for ${client?.full_name ?? ""}`, 105, 35, { align: "center" });
    doc.line(20, 40, 190, 40);

    let y = 55;
    story.content.pages?.forEach((page, i) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(24);
      doc.text(page.emoji, 25, y);
      doc.setFontSize(14);
      const lines = doc.splitTextToSize(page.text, 145);
      doc.text(lines, 45, y);
      y += Math.max(20, lines.length * 8 + 8);
    });

    doc.save(`social-story-${story.title.replace(/\s/g, "-")}.pdf`);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Social Story Creator">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Create Story"}
        </Button>
      </PageHeader>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        📖 Create personalized social stories to help clients navigate social situations and transitions.
        Use AI generation or choose from templates.
      </div>

      {showForm && (
        <Section title="New Social Story">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Scenario</label>
              <select value={scenario} onChange={(e) => handleScenarioSelect(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select scenario...</option>
                {SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Story Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Going to the Doctor"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <Button variant="outline" onClick={generateAIStory} loading={generating} disabled={!scenario}>
              🤖 Generate with AI
            </Button>
            <Button variant="outline" onClick={addPage}>+ Add Page</Button>
          </div>

          {/* PAGE EDITOR */}
          <div className="space-y-3 mb-4">
            {pages.map((page, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-medium text-gray-500 w-16">Page {i + 1}</span>
                  <div className="flex flex-wrap gap-1">
                    {EMOJIS.map((e) => (
                      <button key={e} onClick={() => updatePage(i, "emoji", e)}
                        className={`text-lg p-0.5 rounded ${page.emoji === e ? "bg-blue-200" : "hover:bg-gray-200"}`}>{e}</button>
                    ))}
                  </div>
                  {pages.length > 1 && (
                    <button onClick={() => removePage(i)} className="text-red-400 hover:text-red-600 text-xs ml-auto">Remove</button>
                  )}
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-4xl">{page.emoji}</span>
                  <textarea value={page.text} onChange={(e) => updatePage(i, "text", e.target.value)}
                    placeholder="Write this page of the story..." rows={2}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={!clientId || !title || pages.filter((p) => p.text).length === 0}>
              Save Story
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* STORY PREVIEW MODAL */}
      {previewStory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <p className="font-bold text-gray-800">{previewStory.title}</p>
              <button onClick={() => setPreviewStory(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {previewStory.content.pages?.[previewPage] && (
              <div className="text-center space-y-4 py-4">
                <p className="text-7xl">{previewStory.content.pages[previewPage].emoji}</p>
                <p className="text-lg text-gray-800 font-medium leading-relaxed">
                  {previewStory.content.pages[previewPage].text}
                </p>
                <p className="text-xs text-gray-400">Page {previewPage + 1} of {previewStory.content.pages.length}</p>
              </div>
            )}

            <div className="flex gap-2 justify-center mt-4">
              <button onClick={() => setPreviewPage((p) => Math.max(0, p - 1))} disabled={previewPage === 0}
                className="px-4 py-2 border rounded-lg text-sm disabled:opacity-30">← Prev</button>
              <button onClick={() => setPreviewPage((p) => Math.min((previewStory.content.pages?.length ?? 1) - 1, p + 1))}
                disabled={previewPage >= (previewStory.content.pages?.length ?? 1) - 1}
                className="px-4 py-2 border rounded-lg text-sm disabled:opacity-30">Next →</button>
            </div>
          </div>
        </div>
      )}

      {/* STORY LIST */}
      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && stories.length === 0 && (
        <Section title="Social Stories">
          <p className="text-gray-400 text-sm">No social stories yet.</p>
        </Section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stories.map((story) => (
          <div key={story.id} className="border border-gray-100 rounded-xl p-4 bg-white">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-gray-800">{story.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {clientMap.get(story.client_id) ?? "Unknown"} · {story.content.pages?.length ?? 0} pages
                </p>
              </div>
              <button onClick={() => {
                supabase.from("visual_supports").delete().eq("id", story.id);
                setStories((prev) => prev.filter((s) => s.id !== story.id));
              }} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
            </div>

            {/* PAGE PREVIEW */}
            <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
              {story.content.pages?.slice(0, 4).map((page, i) => (
                <div key={i} className="shrink-0 w-16 h-16 border border-gray-200 rounded-lg bg-gray-50 flex flex-col items-center justify-center text-center p-1">
                  <p className="text-xl">{page.emoji}</p>
                  <p className="text-xs text-gray-500 truncate w-full text-center">{page.text.split(" ").slice(0, 3).join(" ")}...</p>
                </div>
              ))}
              {(story.content.pages?.length ?? 0) > 4 && (
                <div className="shrink-0 w-16 h-16 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                  +{(story.content.pages?.length ?? 0) - 4}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setPreviewStory(story); setPreviewPage(0); }}>
                👁 Preview
              </Button>
              <Button variant="outline" onClick={() => exportPDF(story)}>
                📄 PDF
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}