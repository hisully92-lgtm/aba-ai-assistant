"use client";

import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";

type Video = {
  title: string;
  url: string;
  duration: string;
  description: string;
};

type Module = {
  id: string;
  section: string;
  title: string;
  hours: number;
  bacbRef: string;
  videos: Video[];
  topics: string[];
};

const MODULES: Module[] = [
  {
    id: "A",
    section: "Section A",
    title: "Introduction to Applied Behavior Analysis",
    hours: 2,
    bacbRef: "2026 RBT Curriculum — Section A (2 hours)",
    topics: [
      "Features and purpose of ABA service delivery",
      "Stimuli, responses, and the 3-term contingency",
      "Positive and negative reinforcement",
      "Common functions of problem behavior",
      "Elementary verbal operants (mand, tact, echoic, intraverbal)",
      "Common phases of ABA interventions (baseline, intervention, generalization, maintenance)",
    ],
    videos: [
      {
        title: "Behavior Technician Training Program | 40-Hour RBT Course — Part 1",
        url: "https://www.youtube.com/embed/qBrlTfuHxSU",
        duration: "~60 min",
        description: "Foundations of ABA, autism therapy, data collection, and assessment overview. Covers the full intro to ABA for new RBTs.",
      },
      {
        title: "ABA Therapy: Schedules of Reinforcement",
        url: "https://www.youtube.com/embed/R8NWkfGwJHU",
        duration: "~15 min",
        description: "Fixed ratio, variable ratio, fixed interval, and variable interval reinforcement schedules explained.",
      },
      {
        title: "ABA: Basic Schedules of Reinforcement — FR, VR, FI, VI",
        url: "https://www.youtube.com/embed/ZTWjlQC8eVo",
        duration: "~12 min",
        description: "Clear visual explanation of the four basic reinforcement schedules used in ABA practice.",
      },
    ],
  },
  {
    id: "B",
    section: "Section B",
    title: "Preparing for Service Delivery",
    hours: 1,
    bacbRef: "2026 RBT Curriculum — Section B (1 hour)",
    topics: [
      "Ensure readiness to effectively deliver services",
      "Review procedures and prior session documentation",
      "Prepare the environment (gather materials)",
      "Prepare the client (build rapport, gain assent)",
    ],
    videos: [
      {
        title: "RBT Competency Assessment: Naturalistic Teaching",
        url: "https://www.youtube.com/embed/Phnq0yN2918",
        duration: "~20 min",
        description: "Covers environment setup, client preparation, rapport building, and session readiness as demonstrated in an RBT competency assessment.",
      },
      {
        title: "Unlocking Everyday Learning with Incidental Teaching",
        url: "https://www.youtube.com/embed/FTBmhJRtQbI",
        duration: "~18 min",
        description: "RBT Nicole Dobbins covers incidental teaching and using the natural environment to prepare and deliver services.",
      },
    ],
  },
  {
    id: "C",
    section: "Section C",
    title: "Data Collection and Graphing",
    hours: 3,
    bacbRef: "2026 RBT Curriculum — Section C (3 hours)",
    topics: [
      "Describe behavior and stimuli in observable terms",
      "Operational definitions",
      "Importance of data collection and risks of unreliable data",
      "Common data-collection procedures (continuous, discontinuous, permanent product)",
      "Calculate and summarize data (rate, mean duration, percentage correct)",
      "Common data displays (line graphs, bar graphs)",
      "Enter data and update graphs",
      "Identify changes in graphed data and report to supervisor",
    ],
    videos: [
      {
        title: "ABA Data Collection Training — Frequency, Duration, Latency, IRT, Interval",
        url: "https://www.youtube.com/embed/uwWDLkwscP4",
        duration: "~45 min",
        description: "Comprehensive training on all major data collection methods used in ABA — frequency, duration, latency, IRT, partial/whole interval, and momentary time sampling.",
      },
      {
        title: "Frequency, Duration, Rate, Latency, IRT — RBT Measurement",
        url: "https://www.youtube.com/embed/wYUto4aqNeM",
        duration: "~20 min",
        description: "Covers all measurable dimensions of behavior RBTs must know for the competency assessment and exam.",
      },
      {
        title: "Interval Recording | Momentary Time Sampling — Discontinuous Measurement",
        url: "https://www.youtube.com/embed/U8OsvZPgv28",
        duration: "~18 min",
        description: "In-depth explanation of discontinuous measurement procedures including whole interval, partial interval, and MTS.",
      },
      {
        title: "Graphing for RBTs | Trend, Level, Variability | ABA Line Graphs",
        url: "https://www.youtube.com/embed/uPrCO0v-jg8",
        duration: "~22 min",
        description: "How to read, create, and interpret ABA line graphs including phase change lines, trend, level, and variability.",
      },
      {
        title: "ATCC 2026 RBT Training: The Importance of Data Collection",
        url: "https://www.youtube.com/embed/VMpqtDPCHF8",
        duration: "~10 min",
        description: "Sneak peek from the official ATCC 2026 RBT Training series covering why accurate data collection is critical in ABA.",
      },
    ],
  },
  {
    id: "D",
    section: "Section D",
    title: "Assisting with Behavior Assessments",
    hours: 3,
    bacbRef: "2026 RBT Curriculum — Section D (3 hours)",
    topics: [
      "Purpose of skill-based, preference, and functional assessments",
      "Assist with skill-based assessments",
      "Conduct preference assessments (FOPA, SS, PS, MSWO)",
      "Assist with functional assessments and FBA",
      "Document environmental variables affecting assessment results",
    ],
    videos: [
      {
        title: "RBT Task List Study Guide — Assessment and Skill Acquisition",
        url: "https://www.youtube.com/embed/R9hYtz7B5v0",
        duration: "~30 min",
        description: "Covers RBT Task List sections B (Assessment) and C (Skill Acquisition) — terms, definitions, and practice questions directly from the BACB task list.",
        },
        {
        title: "Functional Behavior Assessment (FBA) — Direct, Indirect, Functional Analysis | RBT & BCBA Exam",
        url: "https://www.youtube.com/embed/fOev3s7ieK4",
        duration: "~25 min",
        description: "Complete breakdown of FBA methods — indirect (interviews, rating scales), direct observation, and functional analysis. Covers what RBTs assist with.",
        },
        {
        title: "Functional Behavior Assessment Procedures — BT Competency Assessment",
        url: "https://www.youtube.com/embed/HR7kpt_zlgI",
        duration: "~15 min",
        description: "Specifically designed for behavior technicians — how to assist with functional assessment procedures as required in the RBT competency assessment.",
        },
        {
        title: "Functional Behavioral Assessment: Conducting an ABC Analysis",
        url: "https://www.youtube.com/embed/Sxf9GPH5A-8",
        duration: "~20 min",
        description: "Live demonstration of conducting an ABC analysis as part of a functional behavior assessment — documents environmental variables affecting behavior.",
        },
        {
        title: "How to Conduct a Preference Assessment (Two-Item and MSWO)",
        url: "https://www.youtube.com/embed/s6imDTKvvFQ",
        duration: "~18 min",
        description: "Step-by-step guide to conducting a two-item paired stimulus and MSWO preference assessment — data collection and summarizing results.",
        },
        {
        title: "How to Conduct MSWO Preference Assessment — ABA",
        url: "https://www.youtube.com/embed/0l-KDILt3-M",
        duration: "~15 min",
        description: "Live demonstration of a Multiple Stimulus Without Replacement (MSWO) preference assessment — presenting stimuli, collecting data, and determining hierarchy.",
        },
        {
        title: "Preference Assessment with Toys — MSWO",
        url: "https://www.youtube.com/embed/fEEelCgBkWA",
        duration: "~10 min",
        description: "Demonstration of MSWO preference assessment conducted with toys — shows exactly how to present stimuli, record selections, and rotate items.",
        },
        {
        title: "How to Choose the Right ABA Assessment (VB-MAPP, ABLLS, MOTAS)",
        url: "https://www.youtube.com/embed/sKXOGofx9VQ",
        duration: "~22 min",
        description: "How to ABA covers how to select and use skill-based assessments including the VB-MAPP and ABLLS-R to individualize goals and track progress.",
        },
    {
        title: "ABA (Applied Behavior Analysis) Techniques by BCBA",
        url: "https://www.youtube.com/embed/BxK-FkRnE9A",
        duration: "~30 min",
        description: "Covers ABA assessment techniques including preference assessment, functional assessment, token economy, and behavior intervention strategies.",
      },
      {
        title: "RBT Task List Practice Questions | Differential Reinforcement",
        url: "https://www.youtube.com/embed/5vMzAnErybk",
        duration: "~25 min",
        description: "RBT task list review covering assessment-related procedures and differential reinforcement from the BACB task list.",
      },
    ],
  },
  {
    id: "E",
    section: "Section E",
    title: "Behavior-Change Interventions",
    hours: 20,
    bacbRef: "2026 RBT Curriculum — Section E (20 hours — largest section)",
    topics: [
      "Procedural integrity",
      "Establishing and using conditioned reinforcers (token economies)",
      "Discrete-trial teaching (DTT)",
      "Naturalistic teaching (incidental teaching, NET)",
      "Task analysis and chaining (forward, backward, total task)",
      "Stimulus and response prompts (errorless teaching, LTM, MTL, stimulus fading)",
      "Discrimination training",
      "Differential reinforcement (DRO, DRA)",
      "Extinction (including secondary effects)",
      "Punishment (including secondary effects)",
      "Shaping",
      "Antecedent intervention (NCR, high-p sequences, choice, activity schedules)",
      "Generalization",
      "Self-monitoring",
      "Crisis intervention",
    ],
    videos: [
      {
        title: "ATCC 2026 RBT Training: Discrete-Trial Teaching",
        url: "https://www.youtube.com/embed/02nHYMdrUhA",
        duration: "~15 min",
        description: "Official 2026 ATCC RBT training sneak peek covering discrete-trial teaching as required by the new BACB curriculum.",
      },
      {
        title: "Discrete Trial Training: DTT in ABA Therapy | RBT & BCBA Review",
        url: "https://www.youtube.com/embed/UxHd0lSLxRc",
        duration: "~20 min",
        description: "Parts of a discrete trial, DTT implementation, error correction, and data collection in ABA therapy.",
      },
      {
        title: "G2: Discrete-Trial Teaching (DTT) Explained | ABA Training for RBTs",
        url: "https://www.youtube.com/embed/4bJXAbP7WOk",
        duration: "~18 min",
        description: "DTT as outlined in the G2 task list for RBTs — covers SD, response, consequence, and inter-trial interval.",
      },
      {
        title: "ATCC 2026 RBT Training: Naturalistic Teaching",
        url: "https://www.youtube.com/embed/FiAMgqV35lw",
        duration: "~12 min",
        description: "Official 2026 ATCC sneak peek on naturalistic teaching strategies for the new RBT curriculum.",
      },
      {
        title: "Natural Environment Teaching (NET) — ABA Techniques at Home",
        url: "https://www.youtube.com/embed/mCDSU7LfZEk",
        duration: "~15 min",
        description: "How to use NET (Natural Environment Teaching) and ABA therapy techniques in home and natural settings.",
      },
      {
        title: "How to Implement Naturalistic Teaching | RBT Study Guide",
        url: "https://www.youtube.com/embed/z9mGqYHfjJY",
        duration: "~16 min",
        description: "Naturalistic teaching strategies — using the learner's natural environment to practice target skills.",
      },
      {
        title: "Task Chaining and Task Analysis (Forward, Backward, Total) | ABA Terms",
        url: "https://www.youtube.com/embed/gKd3OE58DBg",
        duration: "~20 min",
        description: "Complete breakdown of task analysis, forward chaining, backward chaining, and total task chaining for RBT and BCBA exam.",
      },
      {
        title: "What is Chaining & How to Use Chaining to Teach Skills in ABA",
        url: "https://www.youtube.com/embed/nTu4-swoWss",
        duration: "~18 min",
        description: "How to ABA discusses chaining procedures and how to teach complex multi-step behaviors using behavior chains.",
      },
      {
        title: "Differential Reinforcement of Other Behavior (DRO) — BCBA/RBT Exam Prep",
        url: "https://www.youtube.com/embed/S6wkQVNMLa0",
        duration: "~15 min",
        description: "DRO explained — reinforcing the absence of problem behavior during a specified time interval.",
      },
      {
        title: "Differential Reinforcement of Alternative Behavior (DRA)",
        url: "https://www.youtube.com/embed/d8VVl0fnFF8",
        duration: "~12 min",
        description: "DRA explained by Hope Education Services CEO — reinforcing an alternative behavior that serves the same function.",
      },
      {
        title: "Extinction Explained: ABA Insights for Behavior Modification",
        url: "https://www.youtube.com/embed/tb3sd_57s3A",
        duration: "~14 min",
        description: "Understanding extinction, extinction burst, spontaneous recovery, and how to remove reinforcement for problem behavior.",
      },
      {
        title: "ABA Made Easy: Extinction",
        url: "https://www.youtube.com/embed/5wZ9wTJcm1U",
        duration: "~20 min",
        description: "Free RBT/BCBA certification prep series — covers extinction procedures, secondary effects, and clinical application.",
      },
      {
        title: "Behavior Technician Competency Assessment: DTT",
        url: "https://www.youtube.com/embed/pi3rP7Vd6SA",
        duration: "~25 min",
        description: "Full competency assessment example covering discrete trial training — exactly what RBTs must demonstrate.",
      },
      {
        title: "RBT Study Guide: Reinforcement Schedules",
        url: "https://www.youtube.com/embed/XLouVK7kpQs",
        duration: "~22 min",
        description: "Complete RBT study guide on all four basic schedules of reinforcement for the RBT exam and competency assessment.",
      },
    ],
  },
  {
    id: "F",
    section: "Section F",
    title: "Service Delivery Documentation and Reporting",
    hours: 3,
    bacbRef: "2026 RBT Curriculum — Section F (3 hours)",
    topics: [
      "Maintaining confidentiality and documentation (legal, regulatory, workplace requirements)",
      "When and how to document service delivery",
      "Document and report variables that might affect client progress",
      "Seek and prioritize direction from a supervisor",
      "Communicate concerns and suggestions from intervention team",
    ],
    videos: [
      {
        title: "RBT Ethics Code (2.0) — Section 2: Service Delivery",
        url: "https://www.youtube.com/embed/_Kg5rEarr4s",
        duration: "~25 min",
        description: "RBTs do no harm, implement accurately, conduct professionally — covers documentation and reporting responsibilities.",
      },
      {
        title: "ABA Data Sheet: Behavior Data Collection",
        url: "https://www.youtube.com/embed/wujDf8mMdMI",
        duration: "~18 min",
        description: "How to make and use a weekly data sheet for behavior data — frequency, partial interval, and ABC data recording.",
      },
    ],
  },
  {
    id: "G",
    section: "Section G",
    title: "Ethics and Professionalism",
    hours: 5,
    bacbRef: "2026 RBT Curriculum — Section G (5 hours)",
    topics: [
      "Core principles: benefit others; compassion, dignity, respect; integrity; competence",
      "RBT Ethics Code (2.0) and consumer protection",
      "Ethics Code for Behavior Analysts",
      "Multiple relationships — risks and mitigation",
      "Cultural humility and responsiveness",
      "Risks of public statements about professional activities",
      "Addressing, documenting, and reporting professional misconduct",
      "Role of the RBT in behavior-analytic service delivery",
      "Behaving professionally with clients, peers, and supervisors",
      "Effective supervision practices",
    ],
    videos: [
      {
        title: "Your Ethical Responsibilities as an RBT — Inside the BACB",
        url: "https://www.youtube.com/embed/A6MBTtH6fGY",
        duration: "~25 min",
        description: "Official BACB video — Certification Resource Manager Dr. Sarah Jenkins and Director of Ethics Dr. Holly Seniuk discuss RBT ethical responsibilities.",
      },
      {
        title: "Episode 25: Introduction to the RBT Ethics Code (2.0) — Inside the BACB",
        url: "https://www.youtube.com/embed/k6-BuK1WIv8",
        duration: "~30 min",
        description: "Official BACB podcast — CEO Dr. Jim Carr and Director of Ethics Dr. Tyra Sellers discuss the RBT Ethics Code (2.0).",
      },
      {
        title: "RBT Ethics Code (2.0) — Section 1: General Responsibilities",
        url: "https://www.youtube.com/embed/qkyHdCjULyk",
        duration: "~20 min",
        description: "Four core principles, general responsibilities, and professional conduct standards from the RBT Ethics Code.",
      },
      {
        title: "ATCC 2026 RBT Training: BACB Ethics Codes",
        url: "https://www.youtube.com/embed/q7nyNlJwZr8",
        duration: "~15 min",
        description: "Official 2026 ATCC sneak peek covering BACB ethics codes as required in the new 2026 RBT curriculum.",
      },
    ],
  },
  {
    id: "H",
    section: "Section H",
    title: "Next Steps in the Certification Process",
    hours: 1,
    bacbRef: "2026 RBT Curriculum — Section H (1 hour)",
    topics: [
      "Steps to obtain RBT certification",
      "Certification statuses (inactive, voluntary inactive)",
      "Ongoing supervision requirements and documentation",
      "Ethics requirements for maintaining certification",
      "Self-reporting requirements to the BACB",
      "Recertification requirements",
    ],
    videos: [
      {
        title: "How to Become an RBT — Official BACB Video",
        url: "https://www.youtube.com/embed/vht71vxSgOE",
        duration: "~15 min",
        description: "Official BACB video walking through the process of earning RBT certification — eligibility requirements, application, and exam.",
      },
      {
        title: "RBT Certification: New 2026 Requirements Explained",
        url: "https://www.youtube.com/embed/nCtulqs7z84",
        duration: "~20 min",
        description: "Breaks down the new 2026 RBT recertification requirements — shift from annual to biennial renewal and exam changes.",
      },
      {
        title: "Maintaining Your RBT Certification — Inside the BACB",
        url: "https://www.youtube.com/embed/c6C0BXIDpbM",
        duration: "~18 min",
        description: "Official BACB video covering how to maintain RBT certification — supervision, ethics, and recertification.",
      },
      {
        title: "Better Understanding Supervision as an RBT — Inside the BACB",
        url: "https://www.youtube.com/embed/tzx3QWNjvgI",
        duration: "~22 min",
        description: "Official BACB video — Dr. Sarah Jenkins and Rachel Ulrich discuss supervision requirements for RBTs.",
      },
      {
        title: "ATCC 2026 RBT Training: Steps to Obtain RBT Certification",
        url: "https://www.youtube.com/embed/F6jX4Ba7eSQ",
        duration: "~10 min",
        description: "Official ATCC 2026 sneak peek covering the steps to obtain RBT certification under the new 2026 requirements.",
      },
      {
        title: "MAJOR RBT Changes in 2026 — What Every RBT & BCBA Must Know",
        url: "https://www.youtube.com/embed/RBc0L4FwV4E",
        duration: "~25 min",
        description: "Comprehensive breakdown of all 2026 RBT certification changes and what they mean for RBTs and supervising BCBAs.",
      },
    ],
  },
];

const TOTAL_HOURS = MODULES.reduce((a, b) => a + b.hours, 0);

export default function TrainingPage() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("all");

  function toggleComplete(key: string) {
    setCompleted(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const totalVideos = MODULES.reduce((a, b) => a + b.videos.length, 0);
  const completedVideos = completed.size;
  const pct = Math.round((completedVideos / totalVideos) * 100);

  const filtered = filter === "all" ? MODULES : MODULES.filter(m => m.id === filter);

  return (
    <div className="space-y-6">
      <PageHeader title="RBT 40-Hour Training Library" />

      {/* HEADER BANNER */}
      <div className="bg-[#1a2234] rounded-2xl p-5 text-white">
        <p className="font-bold text-lg mb-1">BACB 2026 RBT 40-Hour Training Curriculum</p>
        <p className="text-gray-300 text-sm mb-3">
          All 8 sections of the official 2026 BACB RBT curriculum — {TOTAL_HOURS} hours minimum.
          Videos sourced from official BACB channels, ATCC, and verified ABA educators.
        </p>
        <p className="text-xs text-yellow-300 mb-4">
          ⚠️ This training program is designed to meet the 2026 training eligibility requirement for RBT certification.
          This training is offered independent of the BACB.
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-white bg-opacity-20 rounded-full h-3">
            <div className="h-3 rounded-full bg-green-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-bold text-green-300">{completedVideos}/{totalVideos} videos ({pct}%)</span>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Hours", value: `${TOTAL_HOURS}+`, color: "text-blue-600" },
          { label: "Sections", value: MODULES.length, color: "text-purple-600" },
          { label: "Videos", value: totalVideos, color: "text-green-600" },
          { label: "Completed", value: completedVideos, color: "text-orange-500" },
        ].map(s => (
          <div key={s.label} className="border rounded-xl p-3 text-center bg-white">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* SECTION FILTER */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === "all" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"}`}>
          All Sections
        </button>
        {MODULES.map(m => (
          <button key={m.id} onClick={() => setFilter(m.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === m.id ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"}`}>
            {m.section} ({m.hours}h)
          </button>
        ))}
      </div>

      {/* MODULES */}
      {filtered.map(module => {
        const isOpen = activeModule === module.id;
        const moduleCompleted = module.videos.filter(v => completed.has(`${module.id}-${v.title}`)).length;

        return (
          <div key={module.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
            {/* MODULE HEADER */}
            <button
              onClick={() => setActiveModule(isOpen ? null : module.id)}
              className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                    moduleCompleted === module.videos.length ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {module.id}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{module.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{module.bacbRef}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{module.hours} hours</p>
                    <p className="text-xs text-gray-400">{module.videos.length} videos · {moduleCompleted} done</p>
                  </div>
                  <span className="text-gray-400">{isOpen ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* PROGRESS BAR */}
              <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-green-500 transition-all"
                  style={{ width: `${Math.round((moduleCompleted / module.videos.length) * 100)}%` }} />
              </div>
            </button>

            {/* MODULE CONTENT */}
            {isOpen && (
              <div className="border-t border-gray-100 p-4 space-y-4">
                {/* TOPICS */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Topics Covered</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {module.topics.map(topic => (
                      <div key={topic} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                        {topic}
                      </div>
                    ))}
                  </div>
                </div>

                {/* VIDEOS */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Training Videos</p>
                  <div className="space-y-4">
                    {module.videos.map(video => {
                      const videoKey = `${module.id}-${video.title}`;
                      const isPlaying = activeVideo === videoKey;
                      const isDone = completed.has(videoKey);

                      return (
                        <div key={videoKey}
                          className={`border rounded-xl overflow-hidden transition-all ${isDone ? "border-green-200" : "border-gray-100"}`}>
                          <div className="p-3 flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <button
                                onClick={() => toggleComplete(videoKey)}
                                className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                  isDone ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"
                                }`}
                              >
                                {isDone && "✓"}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm ${isDone ? "line-through text-gray-400" : "text-gray-800"}`}>
                                  {video.title}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">{video.description}</p>
                                <p className="text-xs text-blue-500 mt-1">Duration: {video.duration}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => setActiveVideo(isPlaying ? null : videoKey)}
                                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                                  isPlaying ? "bg-red-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                              >
                                {isPlaying ? "⏹ Close" : "▶ Watch"}
                              </button>
                            </div>
                          </div>

                          {/* VIDEO PLAYER */}
{isPlaying && (
  <div className="border-t border-gray-100">
    <div className="relative bg-black" style={{ paddingBottom: "56.25%" }}>
      <iframe
        src={`${video.url}?autoplay=1&rel=0&modestbranding=1&controls=1&disablekb=1&fs=0`}
        title={video.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen={false}
        style={{
          position: "absolute",
          top: 0, left: 0,
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
    </div>
    <div className="p-3 bg-gray-50 flex justify-between items-center">
      <p className="text-xs text-gray-500">
        Watch the full video, then mark complete
      </p>
      <button
        onClick={() => { toggleComplete(videoKey); setActiveVideo(null); }}
        className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        ✓ Mark Complete
      </button>
    </div>
  </div>
)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* DISCLAIMER */}
      <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4 text-xs text-yellow-700">
        <p className="font-bold mb-1">Important Disclaimer</p>
        <p>
          This training program is designed to meet the 2026 training eligibility requirement for RBT certification.
          This training is offered independent of the BACB. A Responsible Trainer (BCaBA, BCBA, or BCBA-D with 8-hour supervision training)
          must oversee and certify completion. Trainees must complete at least 40 hours in no fewer than 5 days and no more than 180 days.
          The Responsible Trainer must provide each trainee with a completed RBT 2026 40-Hour Training Certificate.
        </p>
      </div>
    </div>
  );
}