"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import jsPDF from "jspdf";

type Client = { id: string; full_name: string };

type StoryPage = {
  text: string;
  page_type: string;
  emoji: string;
};

type SocialStory = {
  id: string;
  client_id: string;
  title: string;
  situation: string;
  target_behavior: string;
  pages: StoryPage[];
  created_at: string;
};

const PAGE_TYPES = [
  { value: "descriptive", label: "Descriptive", color: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "perspective", label: "Perspective", color: "text-purple-700 bg-purple-50 border-purple-200" },
  { value: "directive", label: "Directive", color: "text-green-700 bg-green-50 border-green-200" },
  { value: "affirmative", label: "Affirmative", color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  { value: "cooperative", label: "Cooperative", color: "text-pink-700 bg-pink-50 border-pink-200" },
];

const EMOJIS = ["😊","😢","😡","😨","🤝","👋","🏫","🏥","🚌","🍽️","⭐","💪","🧘","❤️","🎯","🌟"];

const SITUATIONS = [
  "Going to a new place",
  "Waiting in line",
  "Sharing with others",
  "Transitioning between activities",
  "Unexpected changes",
  "Managing frustration",
  "Asking for help",
  "Going to the doctor",
  "Starting school",
];

const emptyPage: StoryPage = {
  text: "",
  page_type: "descriptive",
  emoji: "😊",
};

export default function SocialStoriesPage() {
  const [stories, setStories] = useState<SocialStory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [readingId, setReadingId] = useState<string | null>(null);
  const [readingPage, setReadingPage] = useState(0);

  const [filterClient, setFilterClient] = useState("");

  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [situation, setSituation] = useState("");
  const [targetBehavior, setTargetBehavior] = useState("");
  const [pages, setPages] = useState<StoryPage[]>([{ ...emptyPage }]);

  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: storyData }] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase
        .from("social_stories")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setStories(
      (storyData ?? []).map((s: any) => ({
        ...s,
        pages: Array.isArray(s.pages)
          ? s.pages
          : JSON.parse(s.pages || "[]"),
      }))
    );

    setLoading(false);
  }

  function addPage() {
    setPages((p) => [...p, { ...emptyPage }]);
  }

  function updatePage(i: number, field: keyof StoryPage, value: string) {
    setPages((p) =>
      p.map((pg, idx) => (idx === i ? { ...pg, [field]: value } : pg))
    );
  }

  function removePage(i: number) {
    setPages((p) => p.filter((_, idx) => idx !== i));
  }

  function movePage(i: number, dir: -1 | 1) {
    const copy = [...pages];
    const temp = copy[i];
    copy[i] = copy[i + dir];
    copy[i + dir] = temp;
    setPages(copy);
  }

  function pageTypeColor(type: string) {
    return (
      PAGE_TYPES.find((t) => t.value === type)?.color ||
      "text-gray-700 bg-gray-50 border-gray-200"
    );
  }

  async function generateAI() {
    if (!title || !situation) return;

    setAiLoading(true);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `
Write a social story for a child with autism.

Title: ${title}
Situation: ${situation}
Target behavior: ${targetBehavior || "appropriate behavior"}

Rules:
- 5–6 pages
- simple first-person language
- each page 1–2 sentences
- include emoji per page
- include page_type: descriptive | perspective | directive | affirmative | cooperative

Return ONLY JSON:
[
  {"text":"...", "page_type":"descriptive", "emoji":"😊"}
]
              `,
            },
          ],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || "[]";

      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      setPages(parsed);
    } catch (e) {
      console.error(e);
    }

    setAiLoading(false);
  }

  async function handleSave() {
    if (!clientId || !title || pages.length === 0) return;

    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const cleanPages = pages.filter((p) => p.text.trim());

    const { data } = await supabase
      .from("social_stories")
      .insert([
        {
          client_id: clientId,
          title,
          situation,
          target_behavior: targetBehavior,
          pages: JSON.stringify(cleanPages),
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (data) {
      setStories((prev) => [
        { ...data, pages: cleanPages },
        ...prev,
      ]);
    }

    setClientId("");
    setTitle("");
    setSituation("");
    setTargetBehavior("");
    setPages([{ ...emptyPage }]);
    setShowForm(false);
    setSaving(false);
  }

  function exportPDF(story: SocialStory) {
    const client = clients.find((c) => c.id === story.client_id);
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(story.title, 105, 20, { align: "center" });

    doc.setFontSize(11);
    doc.text(
      `For ${client?.full_name ?? ""}`,
      105,
      30,
      { align: "center" }
    );

    let y = 45;

    story.pages.forEach((p) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(18);
      doc.text(p.emoji, 20, y);

      doc.setFontSize(12);
      const lines = doc.splitTextToSize(p.text, 160);
      doc.text(lines, 40, y);

      y += lines.length * 7 + 12;
    });

    doc.save(`${story.title}.pdf`);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  const filteredStories = filterClient
    ? stories.filter((s) => s.client_id === filterClient)
    : stories;

  const readingStory = stories.find((s) => s.id === readingId);

  return (
    <div className="space-y-6">
      <PageHeader title="Social Stories">
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Create Story"}
        </Button>
      </PageHeader>

      {/* FILTER */}
      <div className="flex gap-3 items-center">
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>

        <p className="text-sm text-gray-400">
          {filteredStories.length} stories
        </p>
      </div>

      {/* READING MODE */}
      {readingStory && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          <div className="p-4 border-b flex justify-between">
            <button onClick={() => setReadingId(null)}>✕</button>
            <p className="font-bold">{readingStory.title}</p>
            <p className="text-sm text-gray-400">
              {readingPage + 1}/{readingStory.pages.length}
            </p>
          </div>

          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <p className="text-7xl mb-4">
                {readingStory.pages[readingPage]?.emoji}
              </p>
              <p className="text-xl">
                {readingStory.pages[readingPage]?.text}
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-4 p-4">
            <Button onClick={() => setReadingPage((p) => Math.max(0, p - 1))}>
              ←
            </Button>
            <Button
              onClick={() =>
                setReadingPage((p) =>
                  Math.min(readingStory.pages.length - 1, p + 1)
                )
              }
            >
              →
            </Button>
          </div>
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <Section title="Create Social Story">
          <div className="grid md:grid-cols-2 gap-4">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="border p-2 rounded"
            >
              <option>Select Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>

            <input
              className="border p-2 rounded"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <select
              className="border p-2 rounded"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
            >
              <option>Situation</option>
              {SITUATIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <input
              className="border p-2 rounded"
              placeholder="Target behavior"
              value={targetBehavior}
              onChange={(e) => setTargetBehavior(e.target.value)}
            />
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={generateAI} loading={aiLoading}>
              ✨ AI Generate
            </Button>
            <Button onClick={addPage}>+ Page</Button>
          </div>

          {/* PAGES */}
          <div className="mt-4 space-y-3">
            {pages.map((p, i) => (
              <div
                key={i}
                className={`border rounded p-3 ${pageTypeColor(
                  p.page_type
                )}`}
              >
                <div className="flex gap-2 mb-2">
                  <select
                    value={p.page_type}
                    onChange={(e) =>
                      updatePage(i, "page_type", e.target.value)
                    }
                  >
                    {PAGE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={p.emoji}
                    onChange={(e) =>
                      updatePage(i, "emoji", e.target.value)
                    }
                  >
                    {EMOJIS.map((e) => (
                      <option key={e}>{e}</option>
                    ))}
                  </select>

                  <button onClick={() => removePage(i)}>✕</button>
                </div>

                <textarea
                  className="w-full border p-2 rounded"
                  value={p.text}
                  onChange={(e) =>
                    updatePage(i, "text", e.target.value)
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} loading={saving}>
              Save
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </Section>
      )}

      {/* LIST */}
      <div className="grid md:grid-cols-2 gap-4">
        {filteredStories.map((s) => (
          <div key={s.id} className="border rounded p-4 bg-white">
            <p className="font-bold">{s.title}</p>
            <p className="text-xs text-gray-400">
              {clientMap.get(s.client_id)} · {s.pages.length} pages
            </p>

            <div className="flex gap-2 mt-3">
              <Button onClick={() => setReadingId(s.id)}>
                📖 Read
              </Button>
              <Button variant="outline" onClick={() => exportPDF(s)}>
                📄 PDF
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}