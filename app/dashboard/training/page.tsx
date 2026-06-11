/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

type Module = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_storage_path: string | null;
  duration_minutes: number;
  order_index: number;
  category: string | null;
  has_quiz: boolean;
  is_required: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
};

type QuizQuestion = {
  id: string;
  module_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string;
  order_index: number;
};

type Progress = {
  id: string;
  user_id: string;
  module_id: string;
  watched: boolean;
  watch_date: string | null;
  minutes_watched: number;
  quiz_passed: boolean;
  quiz_score: number | null;
  quiz_attempts: number;
  completed: boolean;
  completed_at: string | null;
};

type Certificate = {
  id: string;
  total_hours: number;
  modules_completed: number;
  issued_at: string;
  certificate_number: string;
};

type QuizAnswer = Record<string, string>;

const CEU_CATEGORIES = [
  "ABA Fundamentals", "Ethics & Professionalism", "Supervision Training",
  "Behavior Reduction", "Skill Acquisition", "Assessment", "Documentation",
  "HIPAA & Compliance", "Crisis Intervention", "Cultural Responsiveness",
  "Parent Training", "Leadership & Management", "Onboarding", "Other",
];

function isYouTubeOrVimeo(url: string) {
  return url.includes("youtube") || url.includes("youtu.be") || url.includes("vimeo");
}

function getEmbedUrl(url: string) {
  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1]?.split("?")[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes("youtube.com/watch")) {
    const id = new URLSearchParams(url.split("?")[1]).get("v");
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes("vimeo.com/")) {
    const id = url.split("vimeo.com/")[1]?.split("?")[0];
    return `https://player.vimeo.com/video/${id}`;
  }
  return url;
}

export default function TrainingPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, Progress>>({});
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"training" | "admin">("training");
  const [filterCategory, setFilterCategory] = useState("all");

  // Video state
  const [playingModuleId, setPlayingModuleId] = useState<string | null>(null);
  const [videoUnlocked, setVideoUnlocked] = useState<Record<string, boolean>>({});
  const [videoProgress, setVideoProgress] = useState<Record<string, number>>({});
  const [lastAllowedTime, setLastAllowedTime] = useState<Record<string, number>>({});
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Quiz state
  const [quizModuleId, setQuizModuleId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);

  // Admin form state
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", category: "ABA Fundamentals",
    video_url: "", duration_minutes: 0, has_quiz: false, is_required: true,
  });

  // Quiz builder state
  const [buildingQuizFor, setBuildingQuizFor] = useState<string | null>(null);
  const [quizBuilder, setQuizBuilder] = useState<Omit<QuizQuestion, "id" | "module_id">[]>([]);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [existingQuizQuestions, setExistingQuizQuestions] = useState<QuizQuestion[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: companyUser } = await supabase
  .from("company_users")
  .select("company_id, role")
  .eq("user_id", user.id)
  .eq("status", "active")
  .limit(1)
  .maybeSingle();

if (!companyUser) return;
    setRole(companyUser.role);
    setCompanyId(companyUser.company_id);

    const [{ data: moduleData }, { data: progressData }, { data: certData }] = await Promise.all([
      supabase.from("training_modules").select("*")
        .eq("company_id", companyUser.company_id).eq("is_active", true).order("order_index"),
      supabase.from("training_progress").select("*")
        .eq("user_id", user.id).eq("company_id", companyUser.company_id),
      supabase.from("training_certificates").select("*")
        .eq("user_id", user.id).eq("company_id", companyUser.company_id)
        .order("issued_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    setModules(moduleData ?? []);
    const pMap: Record<string, Progress> = {};
    (progressData ?? []).forEach((p: Progress) => { pMap[p.module_id] = p; });
    setProgressMap(pMap);
    if (certData) setCertificate(certData);
    setLoading(false);
  }

  const isAdmin = ["admin", "director", "supervisor", "clinical_director", "developer"].includes(role ?? "");

  const totalMinutes = modules.reduce((sum, m) => sum + (m.duration_minutes || 0), 0);
  const completedMinutes = modules.reduce((sum, m) => {
    const p = progressMap[m.id];
    return sum + (p?.completed ? (m.duration_minutes || 0) : 0);
  }, 0);
  const completedCount = modules.filter(m => progressMap[m.id]?.completed).length;
  const completedHours = completedMinutes / 60;
  const progressPercent = totalMinutes > 0 ? Math.min(100, (completedMinutes / totalMinutes) * 100) : 0;
  const hoursRemaining = Math.max(0, 40 - completedHours);
  const isEligibleForCert = completedHours >= 40;

  const categories = ["all", ...Array.from(new Set(modules.map(m => m.category ?? "Other")))];
  const filtered = filterCategory === "all" ? modules : modules.filter(m => m.category === filterCategory);

  // ── VIDEO CONTROLS ──

  function handleTimeUpdate(moduleId: string) {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    const pct = (vid.currentTime / vid.duration) * 100;

    // Update furthest progress reached
    setVideoProgress(prev => {
      const current = prev[moduleId] ?? 0;
      if (pct > current) {
        setLastAllowedTime(pt => ({ ...pt, [moduleId]: vid.currentTime }));
        return { ...prev, [moduleId]: pct };
      }
      return prev;
    });

    if (pct >= 95 && !videoUnlocked[moduleId]) {
      setVideoUnlocked(prev => ({ ...prev, [moduleId]: true }));
    }
  }

  function handleSeeking(moduleId: string) {
    const vid = videoRef.current;
    if (!vid) return;

    // Allow seeking backwards or on already-completed modules
    const isCompleted = progressMap[moduleId]?.completed ?? false;
    if (isCompleted) return;

    const allowed = lastAllowedTime[moduleId] ?? 0;
    if (vid.currentTime > allowed + 2) {
      vid.currentTime = allowed;
    }
  }

  async function handleVideoComplete(moduleId: string) {
    if (!userId || !companyId) return;
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;

    const existing = progressMap[moduleId];
    const payload = {
      user_id: userId, module_id: moduleId, company_id: companyId,
      watched: true, watch_date: new Date().toISOString(),
      minutes_watched: mod.duration_minutes,
      completed: !mod.has_quiz,
      completed_at: !mod.has_quiz ? new Date().toISOString() : null,
    };

    if (existing) {
      await supabase.from("training_progress").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("training_progress").insert([payload]);
    }
    await refreshProgress();
  }

  async function refreshProgress() {
    if (!userId || !companyId) return;
    const { data } = await supabase.from("training_progress").select("*")
      .eq("user_id", userId).eq("company_id", companyId);
    const pMap: Record<string, Progress> = {};
    (data ?? []).forEach((p: Progress) => { pMap[p.module_id] = p; });
    setProgressMap(pMap);
  }

  // ── QUIZ ──

  async function openQuiz(moduleId: string) {
    setQuizLoading(true);
    setQuizModuleId(moduleId);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    const { data } = await supabase.from("training_quiz_questions").select("*")
      .eq("module_id", moduleId).order("order_index");
    setQuizQuestions(data ?? []);
    setQuizLoading(false);
  }

  async function submitQuiz() {
    if (!quizModuleId || !userId || !companyId) return;
    const total = quizQuestions.length;
    if (total === 0) return;

    let correct = 0;
    quizQuestions.forEach(q => { if (quizAnswers[q.id] === q.correct_answer) correct++; });
    const score = Math.round((correct / total) * 100);
    const passed = score >= 80;
    setQuizScore(score);
    setQuizSubmitted(true);

    const existing = progressMap[quizModuleId];
    const attempts = (existing?.quiz_attempts ?? 0) + 1;
    const payload = {
      user_id: userId, module_id: quizModuleId, company_id: companyId,
      quiz_passed: passed, quiz_score: score, quiz_attempts: attempts,
      completed: passed, completed_at: passed ? new Date().toISOString() : null,
    };

    if (existing) {
      await supabase.from("training_progress").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("training_progress").insert([{
        ...payload, watched: true, watch_date: new Date().toISOString(),
      }]);
    }
    await refreshProgress();
  }

  // ── CERTIFICATE ──

  async function issueCertificate() {
    if (!userId || !companyId) return;
    const certNum = `RBT-${companyId.slice(0, 6).toUpperCase()}-${Date.now()}`;
    const { data } = await supabase.from("training_certificates").insert([{
      user_id: userId, company_id: companyId,
      total_hours: completedHours, modules_completed: completedCount,
      certificate_number: certNum,
    }]).select().single();
    if (data) setCertificate(data);
  }

  function printCertificate() {
    if (!certificate) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>RBT Training Certificate</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Georgia, serif; background: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 40px; }
        .cert { border: 8px double #1e40af; padding: 60px; max-width: 800px; width: 100%; text-align: center; }
        .logo { font-size: 14px; font-weight: bold; color: #1e40af; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 20px; }
        h1 { font-size: 36px; color: #1e3a8a; margin-bottom: 8px; }
        .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 32px; }
        .awarded { font-size: 13px; color: #374151; margin-bottom: 12px; }
        .name { font-size: 28px; color: #111827; border-bottom: 2px solid #1e40af; display: inline-block; padding-bottom: 4px; margin-bottom: 32px; }
        .details { font-size: 14px; color: #374151; line-height: 2; margin-bottom: 40px; }
        .footer { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        .sig-block { text-align: center; }
        .sig-line { width: 160px; border-top: 1px solid #374151; padding-top: 4px; font-size: 12px; color: #6b7280; margin: 0 auto; }
        @media print { body { padding: 0; } }
      </style>
      </head><body>
      <div class="cert">
        <div class="logo">ABA AI</div>
        <h1>Certificate of Completion</h1>
        <div class="subtitle">40-Hour RBT Training Program</div>
        <div class="awarded">This certifies that</div>
        <div class="name">Staff Member</div>
        <div class="details">
          has successfully completed the required 40-hour RBT training program<br>
          comprising <strong>${certificate.modules_completed} training modules</strong> totaling <strong>${certificate.total_hours.toFixed(1)} hours</strong><br>
          of instruction in Applied Behavior Analysis
        </div>
        <div class="footer">
          <div class="sig-block"><div class="sig-line">Supervisor Signature</div></div>
          <div style="text-align:center;font-size:12px;color:#6b7280">
            <div>Certificate #: ${certificate.certificate_number}</div>
            <div>Issued: ${new Date(certificate.issued_at).toLocaleDateString()}</div>
          </div>
          <div class="sig-block"><div class="sig-line">Date</div></div>
        </div>
      </div>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  // ── ADMIN UPLOAD ──

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `training/${companyId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("training-videos").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: urlData } = supabase.storage.from("training-videos").getPublicUrl(path);
      setUploadedFile({ url: urlData.publicUrl, name: file.name });
      const url = URL.createObjectURL(file);
      const vid = document.createElement("video");
      vid.src = url;
      vid.onloadedmetadata = () => {
        const mins = Math.round(vid.duration / 60);
        setForm(prev => ({ ...prev, duration_minutes: mins, video_url: urlData.publicUrl }));
        URL.revokeObjectURL(url);
      };
    }
    setUploading(false);
  }

  async function handleSaveModule() {
    if (!form.title || !companyId || !userId) return;
    setSaving(true);
    const videoUrl = uploadedFile?.url || form.video_url || null;
    const { data } = await supabase.from("training_modules").insert([{
      company_id: companyId, title: form.title,
      description: form.description || null, video_url: videoUrl,
      duration_minutes: form.duration_minutes || 0, order_index: modules.length,
      category: form.category, has_quiz: form.has_quiz,
      is_required: form.is_required, is_active: true, created_by: userId,
    }]).select().single();
    if (data) setModules(prev => [...prev, data]);
    setForm({ title: "", description: "", category: "ABA Fundamentals", video_url: "", duration_minutes: 0, has_quiz: false, is_required: true });
    setUploadedFile(null);
    setShowForm(false);
    setSaving(false);
  }

  async function deleteModule(id: string) {
    await supabase.from("training_modules").update({ is_active: false }).eq("id", id);
    setModules(prev => prev.filter(m => m.id !== id));
  }

  async function openQuizBuilder(moduleId: string) {
    const { data } = await supabase.from("training_quiz_questions").select("*")
      .eq("module_id", moduleId).order("order_index");
    setExistingQuizQuestions(data ?? []);
    setQuizBuilder(data ?? []);
    setBuildingQuizFor(moduleId);
  }

  function addQuizQuestion() {
    setQuizBuilder(prev => [...prev, {
      question: "", option_a: "", option_b: "", option_c: null, option_d: null,
      correct_answer: "a", order_index: prev.length,
    }]);
  }

  async function saveQuizQuestions(moduleId: string) {
    if (quizBuilder.length === 0) return;
    setSavingQuiz(true);
    await supabase.from("training_quiz_questions").delete().eq("module_id", moduleId);
    await supabase.from("training_quiz_questions").insert(
      quizBuilder.map((q, i) => ({ ...q, module_id: moduleId, order_index: i }))
    );
    setBuildingQuizFor(null);
    setQuizBuilder([]);
    setExistingQuizQuestions([]);
    setSavingQuiz(false);
  }

  function formatDuration(minutes: number) {
    if (!minutes) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading training program...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="40-Hour RBT Training Program">
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <button onClick={() => setActiveTab("training")}
                className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${activeTab === "training" ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                Staff View
              </button>
              <button onClick={() => setActiveTab("admin")}
                className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${activeTab === "admin" ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                Admin Panel
              </button>
            </>
          )}
        </div>
      </PageHeader>

      {/* PROGRESS BANNER */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-blue-100 text-sm font-medium mb-0.5">Training Progress</p>
            <p className="text-3xl font-bold">
              {completedHours.toFixed(1)}{" "}
              <span className="text-xl font-normal text-blue-200">/ 40 hours</span>
            </p>
            <p className="text-blue-200 text-sm mt-1">
              {completedCount} of {modules.length} modules complete · {hoursRemaining.toFixed(1)}h remaining
            </p>
          </div>
          <div className="md:w-64">
            <div className="flex justify-between text-xs text-blue-200 mb-1.5">
              <span>{progressPercent.toFixed(0)}% complete</span>
              <span>{isEligibleForCert ? "✓ Eligible for certificate" : `${hoursRemaining.toFixed(1)}h to go`}</span>
            </div>
            <div className="w-full bg-blue-800/50 rounded-full h-3">
              <div className="bg-white rounded-full h-3 transition-all duration-700"
                style={{ width: `${progressPercent}%` }} />
            </div>
            {isEligibleForCert && !certificate && (
              <button onClick={issueCertificate}
                className="mt-3 w-full bg-white text-blue-700 font-semibold text-sm py-2 rounded-xl hover:bg-blue-50 transition-colors">
                🏆 Generate Certificate
              </button>
            )}
            {certificate && (
              <div className="mt-3 bg-white/20 rounded-xl p-2 text-center">
                <p className="text-xs font-medium">🏆 Certificate Issued</p>
                <p className="text-xs text-blue-200 mt-0.5">{certificate.certificate_number}</p>
                <button onClick={printCertificate}
                  className="text-xs text-blue-100 hover:text-white mt-1 underline">
                  Print Certificate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ADMIN PANEL ── */}
      {isAdmin && activeTab === "admin" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Training Module Management</h2>
              <p className="text-sm text-gray-500 mt-0.5">Build your company&apos;s 40-hour RBT training curriculum.</p>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? "Cancel" : "+ Add Module"}
            </Button>
          </div>

          {showForm && (
            <Section title="New Training Module">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Module Title *</label>
                  <input type="text" value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Introduction to ABA Therapy"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {CEU_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Duration (minutes)</label>
                  <input type="number" value={form.duration_minutes || ""}
                    onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 60"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">External Video URL (YouTube, Vimeo, direct MP4)</label>
                  <input type="url" value={form.video_url}
                    onChange={e => setForm({ ...form, video_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <p className="text-xs text-orange-500 mt-1">
                    ⚠️ YouTube/Vimeo links cannot enforce no-skipping. Staff must manually confirm they watched. Upload a video file for full skip protection.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                  <textarea value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Learning objectives and what staff will gain from this module..."
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Or Upload Video File</label>
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${uploadedFile ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-blue-400"}`}>
                    {uploadedFile ? (
                      <div>
                        <p className="text-green-600 font-medium text-sm">✓ {uploadedFile.name}</p>
                        {form.duration_minutes > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{formatDuration(form.duration_minutes)} detected</p>
                        )}
                        <button onClick={() => { setUploadedFile(null); setForm(prev => ({ ...prev, video_url: "", duration_minutes: 0 })); }}
                          className="text-xs text-gray-400 hover:text-red-400 mt-1">
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-3xl mb-2">🎬</p>
                        <p className="text-sm text-gray-600 mb-1">Upload MP4, MOV, or WebM</p>
                        <p className="text-xs text-green-600 mb-3">✓ Full skip protection enforced for uploaded videos</p>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                          {uploading ? "Uploading..." : "Choose Video File"}
                        </Button>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form.has_quiz}
                      onChange={e => setForm({ ...form, has_quiz: e.target.checked })} className="rounded" />
                    Requires quiz (80% to pass)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form.is_required}
                      onChange={e => setForm({ ...form, is_required: e.target.checked })} className="rounded" />
                    Required module
                  </label>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleSaveModule} loading={saving} disabled={!form.title}>Add Module</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </Section>
          )}

          <div className="space-y-3">
            {modules.length === 0 && (
              <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-gray-600 font-semibold">No modules yet</p>
                <p className="text-gray-400 text-sm mt-1">Click &ldquo;+ Add Module&rdquo; to build your 40-hour training program.</p>
              </div>
            )}
            {modules.map((mod, idx) => (
              <div key={mod.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-800">{mod.title}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {mod.category && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{mod.category}</span>}
                        {mod.duration_minutes > 0 && <span className="text-xs text-gray-400">{formatDuration(mod.duration_minutes)}</span>}
                        {mod.has_quiz && <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">📝 Quiz</span>}
                        {mod.is_required && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">Required</span>}
                        {mod.video_url ? (
                          isYouTubeOrVimeo(mod.video_url)
                            ? <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full">External (no skip lock)</span>
                            : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">✓ Skip protected</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">No video yet</span>
                        )}
                      </div>
                      {mod.description && <p className="text-xs text-gray-500 mt-1">{mod.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {mod.has_quiz && (
                      <button onClick={() => openQuizBuilder(mod.id)}
                        className="text-xs px-3 py-1.5 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50">
                        {existingQuizQuestions.length > 0 && buildingQuizFor === mod.id ? "Editing Quiz" : "Edit Quiz"}
                      </button>
                    )}
                    <button onClick={() => deleteModule(mod.id)}
                      className="text-xs px-2 py-1.5 border border-red-200 text-red-400 rounded-lg hover:bg-red-50">
                      Remove
                    </button>
                  </div>
                </div>

                {buildingQuizFor === mod.id && (
                  <div className="mt-4 border-t pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Quiz Builder — {mod.title}</p>
                      <p className="text-xs text-gray-400">Staff must score 80%+ to pass</p>
                    </div>
                    {quizBuilder.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">No questions yet. Click &ldquo;+ Add Question&rdquo; to start.</p>
                    )}
                    {quizBuilder.map((q, qi) => (
                      <div key={qi} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-600">Question {qi + 1}</p>
                          <button onClick={() => setQuizBuilder(prev => prev.filter((_, i) => i !== qi))}
                            className="text-xs text-red-400 hover:text-red-600">Remove</button>
                        </div>
                        <input type="text" placeholder="Question text"
                          value={q.question}
                          onChange={e => setQuizBuilder(prev => prev.map((x, i) => i === qi ? { ...x, question: e.target.value } : x))}
                          className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(["a", "b", "c", "d"] as const).map(opt => (
                            <div key={opt} className={`flex items-center gap-2 p-2 rounded-lg border ${q.correct_answer === opt ? "border-green-400 bg-green-50" : "border-gray-200"}`}>
                              <input type="radio" name={`correct-${qi}`} value={opt}
                                checked={q.correct_answer === opt}
                                onChange={() => setQuizBuilder(prev => prev.map((x, i) => i === qi ? { ...x, correct_answer: opt } : x))} />
                              <input type="text" placeholder={`Option ${opt.toUpperCase()}`}
                                value={(q as any)[`option_${opt}`] ?? ""}
                                onChange={e => setQuizBuilder(prev => prev.map((x, i) => i === qi ? { ...x, [`option_${opt}`]: e.target.value } : x))}
                                className="flex-1 border-none bg-transparent text-xs focus:outline-none" />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400">Select the radio button next to the correct answer (highlighted green).</p>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button onClick={addQuizQuestion}
                        className="text-xs px-3 py-1.5 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50">
                        + Add Question
                      </button>
                      <Button onClick={() => saveQuizQuestions(mod.id)} loading={savingQuiz} disabled={quizBuilder.length === 0}>
                        Save Quiz
                      </Button>
                      <Button variant="outline" onClick={() => { setBuildingQuizFor(null); setQuizBuilder([]); }}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-bold mb-2">📋 40-Hour Program Rules</p>
            <ul className="text-xs space-y-1.5 text-blue-600 list-disc list-inside">
              <li>Uploaded videos: staff cannot skip ahead — forward seeking is blocked until they&apos;ve watched through.</li>
              <li>YouTube/Vimeo: skipping cannot be technically blocked — staff must manually confirm they watched.</li>
              <li>Quizzes unlock only after the video is fully watched. Staff must score 80%+ to pass.</li>
              <li>A certificate is generated once a staff member accumulates 40 hours of completed modules.</li>
              <li>Each company&apos;s training library is completely private — other clinics cannot see your content.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── STAFF TRAINING VIEW ── */}
      {activeTab === "training" && (
        <div className="space-y-4">
          {categories.length > 2 && (
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button key={cat} onClick={() => setFilterCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterCategory === cat ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
                  {cat === "all" ? `All Modules (${modules.length})` : cat}
                </button>
              ))}
            </div>
          )}

          {modules.length === 0 && (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-5xl mb-4">🎓</p>
              <p className="text-gray-600 font-bold text-lg">No training modules yet</p>
              <p className="text-gray-400 text-sm mt-1">
                {isAdmin ? "Go to Admin Panel to add your first training module." : "Your administrator is setting up your training program. Check back soon."}
              </p>
              {isAdmin && <Button onClick={() => setActiveTab("admin")} className="mt-4">Go to Admin Panel</Button>}
            </div>
          )}

          {filtered.map((mod, idx) => {
            const prog = progressMap[mod.id];
            const isCompleted = prog?.completed ?? false;
            const isWatched = prog?.watched ?? false;
            const isPlaying = playingModuleId === mod.id;
            const unlocked = videoUnlocked[mod.id] ?? false;
            const vidProgress = videoProgress[mod.id] ?? 0;
            const quizPassed = prog?.quiz_passed ?? false;
            const isExternal = mod.video_url ? isYouTubeOrVimeo(mod.video_url) : false;

            return (
              <div key={mod.id}
                className={`border rounded-2xl overflow-hidden bg-white transition-all ${isCompleted ? "border-green-200" : "border-gray-200"}`}>
                <div className="p-4 flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold ${isCompleted ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800">{mod.title}</p>
                        <div className="flex gap-2 mt-0.5 flex-wrap items-center">
                          {mod.category && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{mod.category}</span>}
                          {mod.duration_minutes > 0 && <span className="text-xs text-gray-400">{formatDuration(mod.duration_minutes)}</span>}
                          {mod.has_quiz && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${quizPassed ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                              {quizPassed ? "✓ Quiz passed" : "📝 Quiz required"}
                            </span>
                          )}
                          {isCompleted && <span className="text-xs text-green-600 font-medium">✓ Complete</span>}
                        </div>
                        {mod.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{mod.description}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {mod.video_url ? (
                          <button onClick={() => setPlayingModuleId(isPlaying ? null : mod.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${isPlaying ? "bg-red-500 text-white" : isCompleted ? "bg-green-600 text-white hover:bg-green-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                            {isPlaying ? "⏹ Close" : isCompleted ? "↺ Rewatch" : "▶ Watch"}
                          </button>
                        ) : (
                          <span className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400">No video yet</span>
                        )}
                      </div>
                    </div>

                    {isPlaying && !isExternal && vidProgress > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Watch progress</span>
                          <span>{Math.round(vidProgress)}% {vidProgress < 95 ? "— watch to 95% to complete" : "✓ Ready to complete"}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full transition-all ${vidProgress >= 95 ? "bg-green-500" : "bg-blue-500"}`}
                            style={{ width: `${vidProgress}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {isPlaying && mod.video_url && (
                  <div className="border-t border-gray-100">
                    {isExternal ? (
                      <div>
                        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
                          <iframe
                            src={getEmbedUrl(mod.video_url)}
                            title={mod.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                          />
                        </div>
                        <div className="p-3 bg-orange-50 border-t">
                          <p className="text-xs text-orange-700 mb-2">
                            ⚠️ External video — skipping cannot be technically blocked. Please watch the full video before marking complete.
                          </p>
                          {!isWatched && (
                            <button onClick={() => handleVideoComplete(mod.id)}
                              className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">
                              ✓ I have watched this video in full — Mark Complete
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <video
                          ref={playingModuleId === mod.id ? videoRef : null}
                          src={mod.video_url}
                          controls
                          controlsList="nodownload nofullscreen"
                          disablePictureInPicture
                          style={{ width: "100%", maxHeight: "480px", background: "#000" }}
                          onTimeUpdate={() => handleTimeUpdate(mod.id)}
                          onSeeking={() => !isCompleted && handleSeeking(mod.id)}
                          onEnded={() => {
                            setVideoUnlocked(prev => ({ ...prev, [mod.id]: true }));
                            setVideoProgress(prev => ({ ...prev, [mod.id]: 100 }));
                            setLastAllowedTime(prev => ({ ...prev, [mod.id]: videoRef.current?.duration ?? 0 }));
                            handleVideoComplete(mod.id);
                          }}
                        />
                        {!isCompleted && (
                          <div className={`p-3 border-t flex items-center justify-between ${unlocked ? "bg-green-50" : "bg-amber-50"}`}>
                            {unlocked ? (
                              <>
                                <p className="text-xs text-green-700 font-medium">✓ You&apos;ve watched enough to complete this module!</p>
                                {!isWatched && (
                                  <button onClick={() => handleVideoComplete(mod.id)}
                                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                    Mark Complete
                                  </button>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-amber-700">
                                ⏳ Watch at least 95% of this video to unlock completion. Forward skipping is disabled.
                              </p>
                            )}
                          </div>
                        )}
                        {isCompleted && (
                          <div className="p-3 bg-green-50 border-t">
                            <p className="text-xs text-green-700">✓ Module complete. You can rewatch freely.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {mod.has_quiz && isWatched && !quizPassed && (
                      <div className="p-3 bg-yellow-50 border-t flex items-center justify-between">
                        <p className="text-xs text-yellow-700 font-medium">📝 Quiz available — score 80%+ to complete this module.</p>
                        <button onClick={() => openQuiz(mod.id)}
                          className="text-xs px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">
                          Take Quiz
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!isPlaying && mod.has_quiz && isWatched && !quizPassed && (
                  <div className="border-t border-yellow-100 bg-yellow-50 px-4 py-2.5 flex items-center justify-between">
                    <p className="text-xs text-yellow-700">📝 Complete the quiz to finish this module.</p>
                    <button onClick={() => openQuiz(mod.id)}
                      className="text-xs px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">
                      Take Quiz
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── QUIZ MODAL ── */}
      {quizModuleId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800">Module Quiz</p>
                <p className="text-xs text-gray-500 mt-0.5">{modules.find(m => m.id === quizModuleId)?.title}</p>
              </div>
              <button onClick={() => setQuizModuleId(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-5">
              {quizLoading && <p className="text-sm text-gray-400 text-center py-8">Loading questions...</p>}
              {!quizLoading && quizQuestions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No questions have been added to this quiz yet.</p>
              )}
              {!quizLoading && !quizSubmitted && quizQuestions.map((q, qi) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-sm font-semibold text-gray-800">{qi + 1}. {q.question}</p>
                  <div className="space-y-1.5">
                    {(["a", "b", "c", "d"] as const).map(opt => {
                      const val = (q as any)[`option_${opt}`];
                      if (!val) return null;
                      return (
                        <label key={opt}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${quizAnswers[q.id] === opt ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-200"}`}>
                          <input type="radio" name={`q-${q.id}`} value={opt}
                            checked={quizAnswers[q.id] === opt}
                            onChange={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt }))}
                            className="shrink-0" />
                          <span className="text-sm text-gray-700">{val}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {quizSubmitted && quizScore !== null && (
                <div className={`rounded-2xl p-5 text-center ${quizScore >= 80 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  <p className="text-4xl mb-2">{quizScore >= 80 ? "🎉" : "😔"}</p>
                  <p className={`text-2xl font-bold ${quizScore >= 80 ? "text-green-700" : "text-red-700"}`}>{quizScore}%</p>
                  <p className={`text-sm mt-1 ${quizScore >= 80 ? "text-green-600" : "text-red-600"}`}>
                    {quizScore >= 80 ? "You passed! Module marked as complete." : "Score 80% or higher to pass. You can retake this quiz."}
                  </p>
                </div>
              )}
            </div>
            <div className="p-5 border-t flex gap-2 justify-end">
              {!quizSubmitted ? (
                <>
                  <Button variant="outline" onClick={() => setQuizModuleId(null)}>Cancel</Button>
                  <Button onClick={submitQuiz} disabled={Object.keys(quizAnswers).length < quizQuestions.length}>
                    Submit Quiz
                  </Button>
                </>
              ) : (
                <>
                  {quizScore !== null && quizScore < 80 && (
                    <Button onClick={() => { setQuizSubmitted(false); setQuizAnswers({}); setQuizScore(null); }}>
                      Retake Quiz
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setQuizModuleId(null)}>Close</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}