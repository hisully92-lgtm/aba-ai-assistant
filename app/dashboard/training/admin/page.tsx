"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

type Video = {
  id: string;
  module_id: string;
  section: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_seconds: number;
  order_index: number;
  is_published: boolean;
  script: string | null;
  ai_generated: boolean;
  heygen_video_id: string | null;
  heygen_status: string | null;
};

type Quiz = {
  id: string;
  video_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  order_index: number;
};

type HeyGenAvatar = {
  avatar_id: string;
  avatar_name: string;
  preview_image_url: string;
  preview_video_url?: string;
};

type HeyGenVoice = {
  voice_id: string;
  language: string;
  gender: string;
  name: string;
  preview_audio?: string;
};

const SECTIONS = [
  { id: "A", label: "A — Introduction to ABA", hours: 2 },
  { id: "B", label: "B — Preparing for Service Delivery", hours: 1 },
  { id: "C", label: "C — Data Collection and Graphing", hours: 3 },
  { id: "D", label: "D — Assisting with Behavior Assessments", hours: 3 },
  { id: "E", label: "E — Behavior-Change Interventions", hours: 20 },
  { id: "F", label: "F — Documentation and Reporting", hours: 3 },
  { id: "G", label: "G — Ethics and Professionalism", hours: 5 },
  { id: "H", label: "H — Next Steps in Certification", hours: 1 },
];

const emptyVideoForm = {
  section: "A",
  title: "",
  description: "",
  order_index: 0,
  duration_seconds: 0,
};

const emptyQuizForm = {
  question: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_answer: 0,
  explanation: "",
};

export default function TrainingAdminPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [quizzes, setQuizzes] = useState<Map<string, Quiz[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [videoForm, setVideoForm] = useState(emptyVideoForm);
  const [quizForm, setQuizForm] = useState(emptyQuizForm);
  const [activeTab, setActiveTab] = useState<"videos" | "quiz" | "script" | "heygen">("videos");
  const [script, setScript] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // HeyGen state
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [voices, setVoices] = useState<HeyGenVoice[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [voiceFilter, setVoiceFilter] = useState("English");

  useEffect(() => { init(); }, []);
  useEffect(() => {
    return () => { if (pollingInterval) clearInterval(pollingInterval); };
  }, [pollingInterval]);

  async function init() {
    const [{ data: videoData }, { data: quizData }] = await Promise.all([
      supabase.from("training_videos").select("*").order("section").order("order_index"),
      supabase.from("training_quizzes").select("*").order("order_index"),
    ]);

    setVideos(videoData ?? []);

    const quizMap = new Map<string, Quiz[]>();
    (quizData ?? []).forEach((q: any) => {
      const list = quizMap.get(q.video_id) ?? [];
      list.push({ ...q, options: Array.isArray(q.options) ? q.options : JSON.parse(q.options) });
      quizMap.set(q.video_id, list);
    });
    setQuizzes(quizMap);
    setLoading(false);
  }

  async function loadHeyGenAssets() {
    setLoadingAssets(true);
    try {
      const res = await fetch("/api/heygen/avatars");
      const data = await res.json();
      setAvatars(data.avatars ?? []);
      setVoices(data.voices ?? []);

      // Auto-select first English voice
      const firstEnglish = (data.voices ?? []).find((v: HeyGenVoice) =>
        v.language?.toLowerCase().includes("english")
      );
      if (firstEnglish) setSelectedVoice(firstEnglish.voice_id);
    } catch (err) {
      console.error("Failed to load HeyGen assets:", err);
    }
    setLoadingAssets(false);
  }

  async function handleGenerateHeyGen() {
    if (!selectedVideo || !selectedAvatar || !selectedVoice) return;
    const video = videos.find(v => v.id === selectedVideo);
    if (!video?.script && !script) {
      alert("Please generate a script first in the Script tab.");
      return;
    }

    setGenerating(true);
    setGenerationStatus("Submitting to HeyGen...");

    try {
      const res = await fetch("/api/heygen/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: script || video?.script,
          avatar_id: selectedAvatar,
          voice_id: selectedVoice,
          training_video_id: selectedVideo,
          title: video?.title,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setGenerationStatus(`Error: ${data.error}`);
        setGenerating(false);
        return;
      }

      const heygenVideoId = data.video_id;
      setGenerationStatus("Video rendering in HeyGen... this takes 2-5 minutes.");

      // Update local state
      setVideos(prev => prev.map(v =>
        v.id === selectedVideo
          ? { ...v, heygen_video_id: heygenVideoId, heygen_status: "processing" }
          : v
      ));

      // Start polling
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `/api/heygen/status?video_id=${heygenVideoId}&training_video_id=${selectedVideo}`
          );
          const statusData = await statusRes.json();

          if (statusData.status === "completed") {
            clearInterval(interval);
            setPollingInterval(null);
            setGenerationStatus("✅ Video generated and uploaded successfully!");
            setGenerating(false);
            setVideos(prev => prev.map(v =>
              v.id === selectedVideo
                ? {
                    ...v,
                    video_url: statusData.video_url,
                    duration_seconds: statusData.duration ? Math.round(statusData.duration) : 0,
                    is_published: true,
                    heygen_status: "completed",
                    ai_generated: true,
                  }
                : v
            ));
          } else if (statusData.status === "failed") {
            clearInterval(interval);
            setPollingInterval(null);
            setGenerationStatus("❌ Generation failed. Please try again.");
            setGenerating(false);
          } else {
            setGenerationStatus(`Rendering... status: ${statusData.status}`);
          }
        } catch (err) {
          setGenerationStatus("Checking status...");
        }
      }, 10000); // Poll every 10 seconds

      setPollingInterval(interval);
    } catch (err: any) {
      setGenerationStatus(`Error: ${err.message}`);
      setGenerating(false);
    }
  }

  async function handleSaveVideo() {
    if (!videoForm.title || !videoForm.section) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("training_videos").insert([{
      ...videoForm,
      module_id: `section_${videoForm.section}`,
      is_published: false,
      ai_generated: false,
      heygen_status: "none",
      created_by: user.id,
    }]).select().single();

    if (data) setVideos(prev => [...prev, data].sort((a, b) =>
      a.section.localeCompare(b.section) || a.order_index - b.order_index
    ));

    setVideoForm(emptyVideoForm);
    setShowVideoForm(false);
    setSaving(false);
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>, videoId: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const ext = file.name.split(".").pop();
    const path = `training/${videoId}/video.${ext}`;

    const { data, error } = await supabase.storage
      .from("training-videos")
      .upload(path, file, { upsert: true });

    if (!error && data) {
      const { data: urlData } = supabase.storage.from("training-videos").getPublicUrl(path);

      const url = URL.createObjectURL(file);
      const vid = document.createElement("video");
      vid.src = url;
      vid.onloadedmetadata = async () => {
        const duration = Math.round(vid.duration);
        await supabase.from("training_videos").update({
          video_url: urlData.publicUrl,
          duration_seconds: duration,
          is_published: true,
        }).eq("id", videoId);

        setVideos(prev => prev.map(v => v.id === videoId ? {
          ...v,
          video_url: urlData.publicUrl,
          duration_seconds: duration,
          is_published: true,
        } : v));
        URL.revokeObjectURL(url);
      };
    }

    setUploading(false);
  }

  async function togglePublished(id: string, current: boolean) {
    await supabase.from("training_videos").update({ is_published: !current }).eq("id", id);
    setVideos(prev => prev.map(v => v.id === id ? { ...v, is_published: !current } : v));
  }

  async function deleteVideo(id: string) {
    await supabase.from("training_videos").delete().eq("id", id);
    setVideos(prev => prev.filter(v => v.id !== id));
    if (selectedVideo === id) setSelectedVideo(null);
  }

  async function generateScript(videoId: string, title: string, section: string) {
    setGeneratingScript(true);
    setScript("");

    const sectionLabels: Record<string, string> = {
      A: "Introduction to Applied Behavior Analysis",
      B: "Preparing for Service Delivery",
      C: "Data Collection and Graphing",
      D: "Assisting with Behavior Assessments",
      E: "Behavior-Change Interventions",
      F: "Service Delivery Documentation and Reporting",
      G: "Ethics and Professionalism",
      H: "Next Steps in the Certification Process",
    };

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Write a professional training video script for an RBT 40-hour training course.

Section: ${section} — ${sectionLabels[section]}
Video Title: ${title}

Requirements:
- Write as a teleprompter script for an AI video presenter
- Professional, clear, educational tone
- 3-5 minutes of speaking content (approximately 450-750 words)
- Include an introduction, key teaching points with real clinical examples, and a summary
- Reference real ABA clinical practice and BACB 2026 requirements
- End by telling the viewer what the knowledge check quiz will cover
- Format with clear paragraph breaks for natural speech
- Do NOT include stage directions, [PAUSE], or any non-spoken text
- Write only the words the presenter will speak

Begin the script now:`,
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text ?? "";
      setScript(text);

      await supabase.from("training_videos").update({ script: text }).eq("id", videoId);
      setVideos(prev => prev.map(v => v.id === videoId ? { ...v, script: text } : v));
    } catch (err) {
      setScript("Error generating script. Please try again.");
    }

    setGeneratingScript(false);
  }

  async function generateQuizQuestions(videoId: string, title: string, section: string) {
    setGeneratingQuiz(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Create 5 multiple choice quiz questions for an RBT training video.

Section: ${section}
Video Title: ${title}

Requirements:
- Each question must have exactly 4 answer options (A, B, C, D)
- Only one correct answer per question
- Questions should test comprehension of the video topic
- Include a brief explanation for the correct answer
- Difficulty should be appropriate for new RBT trainees
- Base questions on the BACB 2026 RBT Task List

Respond ONLY with valid JSON — no preamble, no markdown, no backticks:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": 0,
    "explanation": "Brief explanation of why this is correct"
  }
]`,
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text ?? "[]";
      const clean = text.replace(/```json|```/g, "").trim();
      const questions = JSON.parse(clean);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const { data: saved } = await supabase.from("training_quizzes").insert([{
          video_id: videoId,
          question: q.question,
          options: JSON.stringify(q.options),
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          order_index: (quizzes.get(videoId)?.length ?? 0) + i,
          created_by: user.id,
        }]).select().single();

        if (saved) {
          setQuizzes(prev => {
            const next = new Map(prev);
            const list = next.get(videoId) ?? [];
            next.set(videoId, [...list, { ...saved, options: q.options }]);
            return next;
          });
        }
      }
    } catch (err) {
      console.error("Quiz generation failed:", err);
    }

    setGeneratingQuiz(false);
  }

  async function handleSaveQuiz() {
    if (!selectedVideo || !quizForm.question) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const options = [quizForm.option_a, quizForm.option_b, quizForm.option_c, quizForm.option_d];
    const existing = quizzes.get(selectedVideo) ?? [];

    const { data } = await supabase.from("training_quizzes").insert([{
      video_id: selectedVideo,
      question: quizForm.question,
      options: JSON.stringify(options),
      correct_answer: quizForm.correct_answer,
      explanation: quizForm.explanation || null,
      order_index: existing.length,
      created_by: user.id,
    }]).select().single();

    if (data) {
      setQuizzes(prev => {
        const next = new Map(prev);
        const list = next.get(selectedVideo) ?? [];
        next.set(selectedVideo, [...list, { ...data, options }]);
        return next;
      });
    }

    setQuizForm(emptyQuizForm);
    setShowQuizForm(false);
    setSaving(false);
  }

  async function deleteQuiz(videoId: string, quizId: string) {
    await supabase.from("training_quizzes").delete().eq("id", quizId);
    setQuizzes(prev => {
      const next = new Map(prev);
      next.set(videoId, (next.get(videoId) ?? []).filter(q => q.id !== quizId));
      return next;
    });
  }

  const selectedVideoObj = videos.find(v => v.id === selectedVideo);
  const selectedQuizzes = selectedVideo ? (quizzes.get(selectedVideo) ?? []) : [];
  const filteredVoices = voices.filter(v =>
    voiceFilter === "all" || v.language?.toLowerCase().includes(voiceFilter.toLowerCase())
  );

  const inputClass = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
  const labelClass = "text-sm font-medium text-gray-700 mb-1 block";

  return (
    <div className="space-y-6">
      <PageHeader title="Training Admin">
        <Button onClick={() => setShowVideoForm(!showVideoForm)}>
          {showVideoForm ? "Cancel" : "+ Add Video"}
        </Button>
      </PageHeader>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Videos", value: videos.length, color: "text-blue-600" },
          { label: "Published", value: videos.filter(v => v.is_published).length, color: "text-green-600" },
          { label: "HeyGen Generated", value: videos.filter(v => v.ai_generated).length, color: "text-purple-600" },
          { label: "Total Quiz Qs", value: Array.from(quizzes.values()).reduce((a, b) => a + b.length, 0), color: "text-orange-500" },
        ].map(s => (
          <div key={s.label} className="border rounded-xl p-3 text-center bg-white">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ADD VIDEO FORM */}
      {showVideoForm && (
        <Section title="Add New Training Video">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>Video Title *</label>
              <input type="text" value={videoForm.title}
                onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                placeholder="e.g. Introduction to Positive Reinforcement"
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Section *</label>
              <select value={videoForm.section}
                onChange={(e) => setVideoForm({ ...videoForm, section: e.target.value })}
                className={inputClass}>
                {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Order Index</label>
              <input type="number" min={0} value={videoForm.order_index}
                onChange={(e) => setVideoForm({ ...videoForm, order_index: parseInt(e.target.value) || 0 })}
                className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea value={videoForm.description}
                onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                rows={3} placeholder="What will trainees learn in this video?"
                className={inputClass} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSaveVideo} loading={saving}>Save Video</Button>
            <Button variant="outline" onClick={() => setShowVideoForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* TWO COLUMN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* VIDEO LIST */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Videos ({videos.length})</p>
          {loading && <p className="text-gray-400 text-sm">Loading...</p>}
          {videos.length === 0 && !loading && (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-400 text-sm">No videos yet. Click "+ Add Video" to get started.</p>
            </div>
          )}
          {videos.map(video => (
            <div key={video.id}
              onClick={() => { setSelectedVideo(video.id); setScript(video.script ?? ""); setGenerationStatus(null); }}
              className={`border rounded-xl p-3 cursor-pointer transition-all ${
                selectedVideo === video.id
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-100 bg-white hover:border-blue-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1 mb-1">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                      {video.section}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      video.is_published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {video.is_published ? "Live" : "Draft"}
                    </span>
                    {video.ai_generated && (
                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                        🤖 HeyGen
                      </span>
                    )}
                    {video.heygen_status === "processing" && (
                      <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full animate-pulse">
                        ⏳ Rendering...
                      </span>
                    )}
                    {quizzes.get(video.id)?.length ? (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        {quizzes.get(video.id)?.length}Q
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">No quiz</span>
                    )}
                  </div>
                  <p className="font-medium text-gray-800 text-sm truncate">{video.title}</p>
                  {video.duration_seconds > 0 && (
                    <p className="text-xs text-gray-400">{Math.floor(video.duration_seconds / 60)} min</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* VIDEO DETAIL */}
        {selectedVideoObj ? (
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-[#1a2234] px-4 py-3">
              <p className="text-white font-bold text-sm">{selectedVideoObj.title}</p>
              <p className="text-gray-400 text-xs">Section {selectedVideoObj.section}</p>
            </div>

            {/* TABS */}
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {(["heygen", "videos", "script", "quiz"] as const).map(tab => (
                <button key={tab} onClick={() => {
                  setActiveTab(tab);
                  if (tab === "heygen" && avatars.length === 0) loadHeyGenAssets();
                }}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors whitespace-nowrap px-2 ${
                    activeTab === tab ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
                  }`}>
                  {tab === "heygen" ? "🤖 HeyGen" :
                   tab === "videos" ? "📹 Upload" :
                   tab === "script" ? "📄 Script" : "📝 Quiz"}
                </button>
              ))}
            </div>

            {/* HEYGEN TAB */}
            {activeTab === "heygen" && (
              <div className="p-4 space-y-4">
                {/* Status */}
                {selectedVideoObj.heygen_status === "completed" && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                    ✅ HeyGen video generated and live in course
                  </div>
                )}
                {selectedVideoObj.heygen_status === "processing" && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    Rendering in HeyGen... check back in a few minutes
                  </div>
                )}

                {loadingAssets ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Loading your HeyGen avatars and voices...</p>
                  </div>
                ) : (
                  <>
                    {/* WORKFLOW */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                      <p className="font-bold">How it works:</p>
                      <p>1️⃣ Generate a script in the Script tab</p>
                      <p>2️⃣ Select your avatar and voice below</p>
                      <p>3️⃣ Click Generate — HeyGen renders the video</p>
                      <p>4️⃣ Video auto-uploads to your course when done (2-5 min)</p>
                    </div>

                    {/* AVATAR SELECTOR */}
                    <div>
                      <label className={labelClass}>Select Avatar *</label>
                      {avatars.length === 0 ? (
                        <div className="text-center py-4 border border-dashed border-gray-200 rounded-xl">
                          <p className="text-gray-400 text-sm">No avatars found.</p>
                          <p className="text-gray-400 text-xs mt-1">Create avatars at app.heygen.com</p>
                          <Button variant="outline" onClick={loadHeyGenAssets} className="mt-2">
                            🔄 Reload
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {avatars.map(avatar => (
                            <button key={avatar.avatar_id}
                              onClick={() => setSelectedAvatar(avatar.avatar_id)}
                              className={`border rounded-xl p-2 text-center transition-all ${
                                selectedAvatar === avatar.avatar_id
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-200 hover:border-blue-300"
                              }`}
                            >
                              {avatar.preview_image_url ? (
                                <img
                                  src={avatar.preview_image_url}
                                  alt={avatar.avatar_name}
                                  className="w-full h-16 object-cover rounded-lg mb-1"
                                />
                              ) : (
                                <div className="w-full h-16 bg-gray-100 rounded-lg mb-1 flex items-center justify-center text-2xl">
                                  👤
                                </div>
                              )}
                              <p className="text-xs text-gray-700 truncate">{avatar.avatar_name}</p>
                              {selectedAvatar === avatar.avatar_id && (
                                <p className="text-xs text-blue-600 font-medium">✓ Selected</p>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* VOICE SELECTOR */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className={labelClass} style={{ margin: 0 }}>Select Voice *</label>
                        <select
                          value={voiceFilter}
                          onChange={(e) => setVoiceFilter(e.target.value)}
                          className="text-xs border rounded px-2 py-1"
                        >
                          <option value="English">English</option>
                          <option value="Spanish">Spanish</option>
                          <option value="French">French</option>
                          <option value="all">All Languages</option>
                        </select>
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl">
                        {filteredVoices.length === 0 ? (
                          <p className="text-gray-400 text-sm p-3">No voices found for selected language.</p>
                        ) : (
                          filteredVoices.slice(0, 30).map(voice => (
                            <button key={voice.voice_id}
                              onClick={() => setSelectedVoice(voice.voice_id)}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                                selectedVoice === voice.voice_id
                                  ? "bg-blue-50 text-blue-700"
                                  : "hover:bg-gray-50 text-gray-700"
                              }`}
                            >
                              <span>{voice.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 capitalize">{voice.gender}</span>
                                {selectedVoice === voice.voice_id && (
                                  <span className="text-blue-500 text-xs font-bold">✓</span>
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {/* SCRIPT PREVIEW */}
                    {(script || selectedVideoObj.script) && (
                      <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                        <p className="text-xs font-medium text-gray-500 mb-1">Script preview</p>
                        <p className="text-xs text-gray-600 line-clamp-3">
                          {(script || selectedVideoObj.script)?.slice(0, 200)}...
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          ~{Math.round(((script || selectedVideoObj.script)?.split(" ").length ?? 0) / 150)} minutes
                        </p>
                      </div>
                    )}

                    {!(script || selectedVideoObj.script) && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
                        ⚠️ No script yet. Go to the Script tab to generate one first.
                      </div>
                    )}

                    {/* GENERATE BUTTON */}
                    <Button
                      onClick={handleGenerateHeyGen}
                      loading={generating}
                      disabled={!selectedAvatar || !selectedVoice || !(script || selectedVideoObj.script)}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      🤖 Generate Video with HeyGen
                    </Button>

                    {generationStatus && (
                      <div className={`rounded-xl p-3 text-sm ${
                        generationStatus.startsWith("✅") ? "bg-green-50 border border-green-200 text-green-700" :
                        generationStatus.startsWith("❌") ? "bg-red-50 border border-red-200 text-red-700" :
                        "bg-blue-50 border border-blue-200 text-blue-700"
                      }`}>
                        {generationStatus.startsWith("Rendering") && (
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block mr-2" />
                        )}
                        {generationStatus}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* UPLOAD TAB */}
            {activeTab === "videos" && (
              <div className="p-4 space-y-4">
                {selectedVideoObj.video_url ? (
                  <div>
                    <video src={selectedVideoObj.video_url} controls style={{ width: "100%", borderRadius: "8px" }} />
                    <p className="text-xs text-green-600 mt-2">
                      ✓ Video live — {Math.floor(selectedVideoObj.duration_seconds / 60)} min
                      {selectedVideoObj.ai_generated && " · 🤖 HeyGen generated"}
                    </p>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                    <p className="text-3xl mb-2">🎬</p>
                    <p className="text-sm text-gray-600 mb-1">Upload video manually</p>
                    <p className="text-xs text-gray-400 mb-3">Or use HeyGen tab to generate automatically</p>
                    <Button onClick={() => fileInputRef.current?.click()} loading={uploading}>
                      Choose Video File
                    </Button>
                    <input ref={fileInputRef} type="file" accept="video/*"
                      onChange={(e) => handleVideoUpload(e, selectedVideoObj.id)}
                      className="hidden" />
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" onClick={() => togglePublished(selectedVideoObj.id, selectedVideoObj.is_published)}>
                    {selectedVideoObj.is_published ? "⬇ Unpublish" : "⬆ Publish"}
                  </Button>
                  {selectedVideoObj.video_url && (
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline" loading={uploading}>
                      🔄 Replace
                    </Button>
                  )}
                  <button onClick={() => deleteVideo(selectedVideoObj.id)}
                    className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                    🗑 Delete
                  </button>
                </div>
              </div>
            )}

            {/* SCRIPT TAB */}
            {activeTab === "script" && (
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <p className="text-sm font-medium text-gray-700">AI Script Generator</p>
                  <Button
                    onClick={() => generateScript(selectedVideoObj.id, selectedVideoObj.title, selectedVideoObj.section)}
                    loading={generatingScript}
                  >
                    ✨ {selectedVideoObj.script ? "Regenerate" : "Generate Script"}
                  </Button>
                </div>

                {generatingScript && (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Writing script...</p>
                  </div>
                )}

                {(script || selectedVideoObj.script) && !generatingScript && (
                  <div>
                    <textarea
                      value={script || selectedVideoObj.script || ""}
                      onChange={(e) => setScript(e.target.value)}
                      rows={20}
                      className="w-full border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 leading-relaxed"
                    />
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <button
                        onClick={() => navigator.clipboard.writeText(script || selectedVideoObj.script || "")}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={async () => {
                          await supabase.from("training_videos").update({ script }).eq("id", selectedVideoObj.id);
                          setVideos(prev => prev.map(v => v.id === selectedVideoObj.id ? { ...v, script } : v));
                        }}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        💾 Save
                      </button>
                      <button
                        onClick={() => { setActiveTab("heygen"); if (avatars.length === 0) loadHeyGenAssets(); }}
                        className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        🤖 Send to HeyGen →
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      ~{Math.round(((script || selectedVideoObj.script)?.split(" ").length ?? 0) / 150)} minutes ·
                      {(script || selectedVideoObj.script)?.split(" ").length ?? 0} words
                    </p>
                  </div>
                )}

                {!(script || selectedVideoObj.script) && !generatingScript && (
                  <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                    <p className="text-3xl mb-2">📄</p>
                    <p className="text-gray-500 text-sm">No script yet</p>
                    <p className="text-gray-400 text-xs mt-1">Click "Generate Script" to create an AI script for this video</p>
                  </div>
                )}
              </div>
            )}

            {/* QUIZ TAB */}
            {activeTab === "quiz" && (
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <p className="text-sm font-medium text-gray-700">{selectedQuizzes.length} questions</p>
                  <div className="flex gap-2">
                    <Button variant="outline"
                      onClick={() => generateQuizQuestions(selectedVideoObj.id, selectedVideoObj.title, selectedVideoObj.section)}
                      loading={generatingQuiz}>
                      ✨ AI Generate 5
                    </Button>
                    <Button onClick={() => setShowQuizForm(!showQuizForm)}>
                      {showQuizForm ? "Cancel" : "+ Add"}
                    </Button>
                  </div>
                </div>

                {generatingQuiz && (
                  <div className="text-center py-6">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Generating questions...</p>
                  </div>
                )}

                {showQuizForm && (
                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
                    <div>
                      <label className={labelClass}>Question *</label>
                      <textarea value={quizForm.question}
                        onChange={(e) => setQuizForm({ ...quizForm, question: e.target.value })}
                        rows={2} className={inputClass} />
                    </div>
                    {(["option_a", "option_b", "option_c", "option_d"] as const).map((opt, i) => (
                      <div key={opt}>
                        <label className={labelClass}>Option {String.fromCharCode(65 + i)}</label>
                        <input type="text" value={quizForm[opt]}
                          onChange={(e) => setQuizForm({ ...quizForm, [opt]: e.target.value })}
                          className={inputClass} />
                      </div>
                    ))}
                    <div>
                      <label className={labelClass}>Correct Answer</label>
                      <select value={quizForm.correct_answer}
                        onChange={(e) => setQuizForm({ ...quizForm, correct_answer: parseInt(e.target.value) })}
                        className={inputClass}>
                        {["A","B","C","D"].map((l, i) => <option key={i} value={i}>Option {l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Explanation</label>
                      <input type="text" value={quizForm.explanation}
                        onChange={(e) => setQuizForm({ ...quizForm, explanation: e.target.value })}
                        className={inputClass} />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveQuiz} loading={saving}>Save</Button>
                      <Button variant="outline" onClick={() => setShowQuizForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {selectedQuizzes.map((q, i) => (
                    <div key={q.id} className="border border-gray-100 rounded-xl p-3 bg-white">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">
                            <span className="text-blue-600 mr-1">{i + 1}.</span>{q.question}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-1">
                            {q.options.map((opt, oi) => (
                              <p key={oi} className={`text-xs px-2 py-1 rounded ${
                                oi === q.correct_answer ? "bg-green-100 text-green-700 font-medium" : "bg-gray-100 text-gray-500"
                              }`}>
                                {String.fromCharCode(65 + oi)}. {opt}
                              </p>
                            ))}
                          </div>
                          {q.explanation && <p className="text-xs text-gray-400 mt-1 italic">💡 {q.explanation}</p>}
                        </div>
                        <button onClick={() => deleteQuiz(selectedVideoObj.id, q.id)}
                          className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedQuizzes.length === 0 && !generatingQuiz && !showQuizForm && (
                  <p className="text-gray-400 text-sm text-center py-4">No questions yet.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center border border-dashed border-gray-200 rounded-2xl" style={{ minHeight: "400px" }}>
            <div className="text-center">
              <p className="text-3xl mb-2">👈</p>
              <p className="text-gray-500 text-sm">Select a video to manage it</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
