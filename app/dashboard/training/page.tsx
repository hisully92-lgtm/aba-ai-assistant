"use client";

import { useState } from "react";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

type Video = {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  category: string;
  duration: string;
  level: string;
  tags: string[];
};

const VIDEOS: Video[] = [
  {
    id: "1",
    title: "Introduction to ABA Therapy",
    description: "A comprehensive overview of Applied Behavior Analysis principles, reinforcement, and the ABCs of behavior.",
    youtubeId: "DGDfhF_YEsQ",
    category: "RBT Training",
    duration: "10 min",
    level: "Beginner",
    tags: ["ABA basics", "reinforcement", "RBT"],
  },
  {
    id: "2",
    title: "Discrete Trial Training (DTT) Explained",
    description: "Step-by-step guide to running DTT sessions including SD, response, consequence, and inter-trial interval.",
    youtubeId: "V7rZB7RMCyQ",
    category: "RBT Training",
    duration: "12 min",
    level: "Beginner",
    tags: ["DTT", "skill acquisition", "RBT"],
  },
  {
    id: "3",
    title: "Natural Environment Teaching (NET)",
    description: "How to teach skills in the natural environment using motivation and child-led activities.",
    youtubeId: "Q4gUfE3pDyc",
    category: "RBT Training",
    duration: "8 min",
    level: "Beginner",
    tags: ["NET", "naturalistic teaching", "RBT"],
  },
  {
    id: "4",
    title: "ABA Data Collection Methods",
    description: "Frequency, duration, interval recording, and permanent product — how and when to use each method.",
    youtubeId: "Yf5NkRPJjDg",
    category: "RBT Training",
    duration: "15 min",
    level: "Beginner",
    tags: ["data collection", "frequency", "duration", "RBT"],
  },
  {
    id: "5",
    title: "Prompting Strategies in ABA",
    description: "Full physical, partial physical, model, gesture, and vocal prompts — how to use and fade them.",
    youtubeId: "oB_Pkq7ZVNE",
    category: "RBT Training",
    duration: "11 min",
    level: "Intermediate",
    tags: ["prompting", "prompt fading", "RBT"],
  },
  {
    id: "6",
    title: "Positive Reinforcement in ABA",
    description: "Understanding and applying positive reinforcement effectively with children receiving ABA services.",
    youtubeId: "xGaMaGgxkAc",
    category: "RBT Training",
    duration: "9 min",
    level: "Beginner",
    tags: ["reinforcement", "behavior", "RBT"],
  },
  {
    id: "7",
    title: "Functional Behavior Assessment (FBA)",
    description: "How to conduct a thorough FBA including indirect, direct observation, and experimental methods.",
    youtubeId: "gElcFNrjAFA",
    category: "BCBA Training",
    duration: "20 min",
    level: "Advanced",
    tags: ["FBA", "functional analysis", "BCBA"],
  },
  {
    id: "8",
    title: "Writing Behavior Intervention Plans",
    description: "Components of an effective BIP — operational definitions, replacement behaviors, reinforcement systems.",
    youtubeId: "rWH1AwEf1XU",
    category: "BCBA Training",
    duration: "18 min",
    level: "Advanced",
    tags: ["BIP", "behavior plan", "BCBA"],
  },
  {
    id: "9",
    title: "Visual Analysis of ABA Data",
    description: "How to read and interpret ABA graphs — level, trend, variability, and phase change lines.",
    youtubeId: "7S-IHMM8rFo",
    category: "BCBA Training",
    duration: "14 min",
    level: "Advanced",
    tags: ["graphs", "visual analysis", "data", "BCBA"],
  },
  {
    id: "10",
    title: "VB-MAPP Assessment Overview",
    description: "Introduction to the Verbal Behavior Milestones Assessment and Placement Program.",
    youtubeId: "jC8A7j5TSSE",
    category: "BCBA Training",
    duration: "16 min",
    level: "Advanced",
    tags: ["VB-MAPP", "assessment", "BCBA"],
  },
  {
    id: "11",
    title: "What is ABA Therapy? Parent Guide",
    description: "A parent-friendly introduction to ABA therapy, what to expect, and how to support your child at home.",
    youtubeId: "KaFPEPCP6Hw",
    category: "Parent Training",
    duration: "7 min",
    level: "Beginner",
    tags: ["parent training", "ABA basics", "family"],
  },
  {
    id: "12",
    title: "Using Reinforcement at Home",
    description: "Practical strategies for parents to use reinforcement effectively during daily routines.",
    youtubeId: "sM_c0H0YASE",
    category: "Parent Training",
    duration: "8 min",
    level: "Beginner",
    tags: ["reinforcement", "parent training", "home"],
  },
  {
    id: "13",
    title: "Managing Challenging Behaviors",
    description: "Evidence-based strategies for parents to respond to challenging behaviors calmly and effectively.",
    youtubeId: "Vr5xJFZk7_k",
    category: "Parent Training",
    duration: "12 min",
    level: "Beginner",
    tags: ["behavior management", "tantrums", "parent training"],
  },
  {
    id: "14",
    title: "BACB Ethics Code Overview",
    description: "Overview of the BACB Professional and Ethical Compliance Code for behavior analysts.",
    youtubeId: "FZhJu7bMT9A",
    category: "Ethics & Professional",
    duration: "15 min",
    level: "Intermediate",
    tags: ["ethics", "BACB", "professional conduct"],
  },
  {
    id: "15",
    title: "HIPAA Compliance for ABA Providers",
    description: "What ABA clinicians need to know about HIPAA — protected health information, documentation, and security.",
    youtubeId: "fU0ekFxGoMA",
    category: "Ethics & Professional",
    duration: "13 min",
    level: "Intermediate",
    tags: ["HIPAA", "compliance", "documentation"],
  },
  {
    id: "16",
    title: "Behavioral Skills Training (BST)",
    description: "The four components of BST — instructions, modeling, rehearsal, and feedback for staff training.",
    youtubeId: "wMGcSmPWbCo",
    category: "Supervision",
    duration: "14 min",
    level: "Intermediate",
    tags: ["BST", "supervision", "staff training"],
  },
  {
    id: "17",
    title: "RBT Supervision Best Practices",
    description: "How BCBAs can provide effective, competency-based supervision to Registered Behavior Technicians.",
    youtubeId: "y8Mvr7UhDmA",
    category: "Supervision",
    duration: "17 min",
    level: "Advanced",
    tags: ["supervision", "RBT", "BCBA", "feedback"],
  },
  {
    id: "18",
    title: "Task Analysis in ABA",
    description: "How to write and implement task analyses for daily living and vocational skills.",
    youtubeId: "tJPqHYPz3Vk",
    category: "BCBA Training",
    duration: "11 min",
    level: "Intermediate",
    tags: ["task analysis", "skill acquisition", "BCBA"],
  },
];

const CATEGORIES = ["All", "RBT Training", "BCBA Training", "Parent Training", "Ethics & Professional", "Supervision"];
const LEVELS = ["All", "Beginner", "Intermediate", "Advanced"];

export default function TrainingPage() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterLevel, setFilterLevel] = useState("All");
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("completed_training");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });

  function toggleCompleted(id: string) {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem("completed_training", JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const filtered = VIDEOS.filter((v) => {
    const matchSearch = !search ||
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase()) ||
      v.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filterCategory === "All" || v.category === filterCategory;
    const matchLevel = filterLevel === "All" || v.level === filterLevel;
    return matchSearch && matchCat && matchLevel;
  });

  const completedCount = VIDEOS.filter((v) => completedIds.has(v.id)).length;

  function levelColor(level: string) {
    if (level === "Beginner") return "bg-green-100 text-green-700";
    if (level === "Intermediate") return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  }

  function categoryColor(cat: string) {
    if (cat === "RBT Training") return "bg-blue-100 text-blue-700";
    if (cat === "BCBA Training") return "bg-purple-100 text-purple-700";
    if (cat === "Parent Training") return "bg-pink-100 text-pink-700";
    if (cat === "Ethics & Professional") return "bg-orange-100 text-orange-700";
    if (cat === "Supervision") return "bg-teal-100 text-teal-700";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Video Training Library">
        <p className="text-gray-500 text-sm">{completedCount}/{VIDEOS.length} completed</p>
      </PageHeader>

      {/* PROGRESS */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-700">Training Progress</p>
          <p className="text-sm font-bold text-blue-600">{Math.round((completedCount / VIDEOS.length) * 100)}%</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className="bg-blue-500 h-3 rounded-full transition-all"
            style={{ width: `${(completedCount / VIDEOS.length) * 100}%` }} />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {CATEGORIES.slice(1).map((cat) => {
            const catVideos = VIDEOS.filter((v) => v.category === cat);
            const catDone = catVideos.filter((v) => completedIds.has(v.id)).length;
            return (
              <span key={cat} className={`text-xs px-2 py-0.5 rounded-full ${categoryColor(cat)}`}>
                {cat.split(" ")[0]}: {catDone}/{catVideos.length}
              </span>
            );
          })}
        </div>
      </div>

      {/* VIDEO MODAL */}
      {activeVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                title={activeVideo.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-lg">{activeVideo.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{activeVideo.description}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor(activeVideo.category)}`}>{activeVideo.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${levelColor(activeVideo.level)}`}>{activeVideo.level}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{activeVideo.duration}</span>
                  </div>
                </div>
                <button onClick={() => setActiveVideo(null)} className="text-gray-400 hover:text-gray-600 text-xl shrink-0">✕</button>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { toggleCompleted(activeVideo.id); setActiveVideo(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${completedIds.has(activeVideo.id) ? "bg-gray-100 text-gray-600" : "bg-green-500 text-white hover:bg-green-600"}`}>
                  {completedIds.has(activeVideo.id) ? "✓ Mark Incomplete" : "✓ Mark Complete"}
                </button>
                <button onClick={() => setActiveVideo(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search videos..."
          className="border rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setFilterCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterCategory === cat ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-300"}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {LEVELS.map((lvl) => (
            <button key={lvl} onClick={() => setFilterLevel(lvl)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterLevel === lvl ? "bg-gray-700 text-white border-gray-700" : "border-gray-300 text-gray-600"}`}>
              {lvl}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-400">{filtered.length} videos</p>
      </div>

      {/* VIDEO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((video) => {
          const isDone = completedIds.has(video.id);
          return (
            <div key={video.id} className={`border rounded-xl bg-white overflow-hidden hover:shadow-md transition-shadow ${isDone ? "border-green-200" : "border-gray-100"}`}>
              <div className="relative cursor-pointer group" onClick={() => setActiveVideo(video)}>
                <img
                  src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
                  alt={video.title}
                  className="w-full aspect-video object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"; }}
                />
                <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                  <div className="w-14 h-14 bg-white bg-opacity-95 rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-red-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                {isDone && (
                  <div className="absolute top-2 right-2 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-0.5 rounded">
                  {video.duration}
                </div>
              </div>
              <div className="p-4">
                <div className="flex gap-2 mb-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor(video.category)}`}>{video.category}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${levelColor(video.level)}`}>{video.level}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 leading-tight">{video.title}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{video.description}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setActiveVideo(video)}
                    className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    Watch
                  </button>
                  <button onClick={() => toggleCompleted(video.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${isDone ? "border-green-500 text-green-600 bg-green-50" : "border-gray-300 text-gray-500 hover:border-green-400"}`}>
                    {isDone ? "✓" : "○"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}