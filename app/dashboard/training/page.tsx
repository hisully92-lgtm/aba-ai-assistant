"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

type TrainingVideo = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  section: string;
  duration_seconds: number;
  is_published: boolean;
  ai_generated: boolean;
  created_at: string;
};

const CEU_CATEGORIES = [
  "ABA Fundamentals",
  "Ethics & Professionalism",
  "Supervision Training",
  "Behavior Reduction",
  "Skill Acquisition",
  "Assessment",
  "Documentation",
  "HIPAA & Compliance",
  "Crisis Intervention",
  "Cultural Responsiveness",
  "Parent Training",
  "Leadership & Management",
  "Other CEU",
];

export default function TrainingLibraryPage() {
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [role, setRole] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    section: "ABA Fundamentals",
    video_url: "",
    duration_seconds: 0,
  });

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: profileData }, { data: videoData }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase.from("training_videos")
        .select("*")
        .eq("is_published", true)
        .order("section")
        .order("order_index"),
    ]);

    setRole(profileData?.role ?? null);
    setVideos(videoData ?? []);
    setLoading(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const ext = file.name.split(".").pop();
    const path = `training/library/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("training-videos")
      .upload(path, file, { upsert: true });

    if (!error && data) {
      const { data: urlData } = supabase.storage.from("training-videos").getPublicUrl(path);
      setUploadedFile({ url: urlData.publicUrl, name: file.name });

      // Get duration
      const url = URL.createObjectURL(file);
      const vid = document.createElement("video");
      vid.src = url;
      vid.onloadedmetadata = () => {
        setForm(prev => ({ ...prev, duration_seconds: Math.round(vid.duration), video_url: urlData.publicUrl }));
        URL.revokeObjectURL(url);
      };
    }

    setUploading(false);
  }

  async function handleSave() {
    if (!form.title) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const videoUrl = uploadedFile?.url || form.video_url || null;

    const { data } = await supabase.from("training_videos").insert([{
      title: form.title,
      description: form.description || null,
      section: form.section,
      video_url: videoUrl,
      duration_seconds: form.duration_seconds || 0,
      module_id: `library_${form.section.toLowerCase().replace(/\s/g, "_")}`,
      is_published: true,
      ai_generated: false,
      order_index: videos.length,
      created_by: user.id,
    }]).select().single();

    if (data) setVideos(prev => [...prev, data]);
    setForm({ title: "", description: "", section: "ABA Fundamentals", video_url: "", duration_seconds: 0 });
    setUploadedFile(null);
    setShowForm(false);
    setSaving(false);
  }

  async function deleteVideo(id: string) {
    await supabase.from("training_videos").update({ is_published: false }).eq("id", id);
    setVideos(prev => prev.filter(v => v.id !== id));
  }

  const isAdmin = ["admin", "director", "supervisor", "developer"].includes(role ?? "");

  const categories = ["all", ...new Set(videos.map(v => v.section))];
  const filtered = filterCategory === "all" ? videos : videos.filter(v => v.section === filterCategory);

  function formatDuration(seconds: number) {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="CEU Training Library">
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Training Video"}
          </Button>
        )}
      </PageHeader>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-bold mb-1">📚 Staff Training & CEU Library</p>
        <p className="text-xs">
          Upload your own training videos for staff CEU requirements, onboarding, and clinical skill development.
          Videos are accessible to all staff members. Admins can upload and manage content.
        </p>
      </div>

      {isAdmin && showForm && (
        <Section title="Add Training Video">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Video Title *</label>
              <input type="text" value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Ethics in ABA Practice, Reinforcement Fundamentals..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
              <select value={form.section}
                onChange={e => setForm({ ...form, section: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {CEU_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">External Video URL (optional)</label>
              <input type="url" value={form.video_url}
                onChange={e => setForm({ ...form, video_url: e.target.value })}
                placeholder="https://... (YouTube, Vimeo, direct MP4)"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
              <textarea value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What will staff learn in this video? Learning objectives, CEU credits, target audience..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Upload Video File (optional)</label>
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${uploadedFile ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-blue-400"}`}>
                {uploadedFile ? (
                  <div>
                    <p className="text-green-600 font-medium text-sm">✓ {uploadedFile.name}</p>
                    {form.duration_seconds > 0 && <p className="text-xs text-gray-500 mt-1">{formatDuration(form.duration_seconds)}</p>}
                    <button onClick={() => { setUploadedFile(null); setForm(prev => ({ ...prev, video_url: "", duration_seconds: 0 })); }}
                      className="text-xs text-gray-400 hover:text-red-400 mt-1">Remove</button>
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl mb-2">🎬</p>
                    <p className="text-sm text-gray-600 mb-2">Upload MP4, MOV, or WebM</p>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                      {uploading ? "Uploading..." : "Choose Video File"}
                    </Button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="video/*"
                  onChange={handleFileUpload} className="hidden" />
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={!form.title}>
              Add to Library
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Section>
      )}

      {/* CATEGORY FILTER */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilterCategory(cat)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${filterCategory === cat ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
            {cat === "all" ? `All (${videos.length})` : cat}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {!loading && videos.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-5xl mb-4">🎬</p>
          <p className="text-gray-600 font-bold text-lg">No training videos yet</p>
          <p className="text-gray-400 text-sm mt-1">
            {isAdmin ? "Click \"+ Add Training Video\" to upload your first CEU video." : "Your administrator hasn't added any training videos yet."}
          </p>
          {isAdmin && (
            <Button onClick={() => setShowForm(true)} className="mt-4">
              + Add First Video
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(video => {
          const isPlaying = playingId === video.id;
          return (
            <div key={video.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
              <div className="p-4 flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl ${video.video_url ? "bg-blue-100" : "bg-gray-100"}`}>
                  {video.video_url ? "🎬" : "📄"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-800">{video.title}</p>
                      <div className="flex gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{video.section}</span>
                        {video.duration_seconds > 0 && (
                          <span className="text-xs text-gray-400">{formatDuration(video.duration_seconds)}</span>
                        )}
                        {video.ai_generated && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">🤖 AI Generated</span>
                        )}
                      </div>
                      {video.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{video.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {video.video_url && (
                        <button
                          onClick={() => setPlayingId(isPlaying ? null : video.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${isPlaying ? "bg-red-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                        >
                          {isPlaying ? "⏹ Close" : "▶ Watch"}
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => deleteVideo(video.id)}
                          className="text-xs px-2 py-1.5 border border-red-200 text-red-400 rounded-lg hover:bg-red-50">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {isPlaying && video.video_url && (
                <div className="border-t border-gray-100">
                  {video.video_url.includes("youtube") || video.video_url.includes("youtu.be") || video.video_url.includes("vimeo") ? (
                    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
                      <iframe
                        src={video.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/")}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                      />
                    </div>
                  ) : (
                    <video
                      src={video.video_url}
                      controls
                      controlsList="nodownload"
                      disablePictureInPicture
                      style={{ width: "100%", maxHeight: "480px" }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && videos.length > 0 && (
        <div className="text-center">
          <p className="text-xs text-gray-400">
            {videos.length} videos in library · Accessible to all staff ·
            <button onClick={() => window.location.href = "/dashboard/training/admin"} className="text-blue-500 hover:underline ml-1">
              Go to 40-Hour Course Admin →
            </button>
          </p>
        </div>
      )}
    </div>
  );
}