"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import Link from "next/link";

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
};

type Progress = {
  video_id: string;
  completed: boolean;
  quiz_passed: boolean;
  watched_seconds: number;
  quiz_best_score: number;
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

const SECTION_LABELS: Record<string, string> = {
  A: "Introduction to Applied Behavior Analysis",
  B: "Preparing for Service Delivery",
  C: "Data Collection and Graphing",
  D: "Assisting with Behavior Assessments",
  E: "Behavior-Change Interventions",
  F: "Service Delivery Documentation and Reporting",
  G: "Ethics and Professionalism",
  H: "Next Steps in the Certification Process",
};

const SECTION_HOURS: Record<string, number> = {
  A: 2, B: 1, C: 3, D: 3, E: 20, F: 3, G: 5, H: 1,
};

export default function TrainingCoursePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [progress, setProgress] = useState<Map<string, Progress>>(new Map());
  const [quizzes, setQuizzes] = useState<Map<string, Quiz[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const watchTimerRef = useRef<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    return () => {
      if (watchTimerRef.current) clearInterval(watchTimerRef.current);
    };
  }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const [{ data: videoData }, { data: progressData }, { data: quizData }] = await Promise.all([
      supabase.from("training_videos").select("*").eq("is_published", true).order("section").order("order_index"),
      supabase.from("training_progress").select("*").eq("user_id", user.id),
      supabase.from("training_quizzes").select("*").order("order_index"),
    ]);

    setVideos(videoData ?? []);

    const progressMap = new Map<string, Progress>();
    (progressData ?? []).forEach((p: any) => progressMap.set(p.video_id, p));
    setProgress(progressMap);

    const quizMap = new Map<string, Quiz[]>();
    (quizData ?? []).forEach((q: any) => {
      const list = quizMap.get(q.video_id) ?? [];
      list.push({ ...q, options: Array.isArray(q.options) ? q.options : JSON.parse(q.options) });
      quizMap.set(q.video_id, list);
    });
    setQuizzes(quizMap);

    setLoading(false);
  }

  function isUnlocked(video: Video, allVideos: Video[]): boolean {
    const idx = allVideos.findIndex(v => v.id === video.id);
    if (idx === 0) return true;
    const prev = allVideos[idx - 1];
    const prevProgress = progress.get(prev.id);
    return !!prevProgress?.quiz_passed;
  }

  function startVideo(video: Video) {
    setActiveVideo(video);
    setShowQuiz(false);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setVideoWatched(false);
    setWatchSeconds(0);
    if (watchTimerRef.current) clearInterval(watchTimerRef.current);
  }

  function handleVideoPlay() {
    if (watchTimerRef.current) clearInterval(watchTimerRef.current);
    watchTimerRef.current = setInterval(() => {
      setWatchSeconds(prev => {
        const next = prev + 1;
        const duration = videoRef.current?.duration ?? 0;
        if (duration > 0 && next >= duration * 0.9) {
          setVideoWatched(true);
          if (watchTimerRef.current) clearInterval(watchTimerRef.current);
        }
        return next;
      });
    }, 1000);
  }

  function handleVideoPause() {
    if (watchTimerRef.current) clearInterval(watchTimerRef.current);
  }

  function handleVideoEnded() {
    if (watchTimerRef.current) clearInterval(watchTimerRef.current);
    setVideoWatched(true);
    if (activeVideo && userId) {
      saveProgress(activeVideo.id, true, false);
    }
  }

  // Prevent seeking
  function handleSeeking() {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime > watchSeconds + 2) {
      video.currentTime = watchSeconds;
    }
  }

  async function saveProgress(videoId: string, completed: boolean, quizPassed: boolean, score?: number) {
    if (!userId) return;
    await supabase.from("training_progress").upsert({
      user_id: userId,
      video_id: videoId,
      completed,
      quiz_passed: quizPassed,
      watched_seconds: watchSeconds,
      quiz_best_score: score ?? 0,
      completed_at: completed && quizPassed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,video_id" });

    setProgress(prev => {
      const next = new Map(prev);
      next.set(videoId, {
        video_id: videoId,
        completed,
        quiz_passed: quizPassed,
        watched_seconds: watchSeconds,
        quiz_best_score: score ?? next.get(videoId)?.quiz_best_score ?? 0,
      });
      return next;
    });
  }

  async function submitQuiz() {
    if (!activeVideo || !userId) return;
    const videoQuizzes = quizzes.get(activeVideo.id) ?? [];
    if (videoQuizzes.length === 0) return;

    setSubmittingQuiz(true);

    let correct = 0;
    videoQuizzes.forEach((q, i) => {
      if (quizAnswers[i] === q.correct_answer) correct++;
    });

    const score = Math.round((correct / videoQuizzes.length) * 100);
    const passed = score === 100;
    setQuizScore(score);
    setQuizSubmitted(true);

    // Save attempt
    await supabase.from("training_quiz_attempts").insert([{
      user_id: userId,
      video_id: activeVideo.id,
      answers: JSON.stringify(Object.values(quizAnswers)),
      score,
      passed,
    }]);

    // Update progress
    const existing = progress.get(activeVideo.id);
    const bestScore = Math.max(score, existing?.quiz_best_score ?? 0);
    await saveProgress(activeVideo.id, true, passed, bestScore);

    setSubmittingQuiz(false);
  }

  function retryQuiz() {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(0);
  }

  function proceedToNext() {
    if (!activeVideo) return;
    const idx = videos.findIndex(v => v.id === activeVideo.id);
    if (idx < videos.length - 1) {
      startVideo(videos[idx + 1]);
    } else {
      setActiveVideo(null);
    }
  }

  // Group by section
  const sections = Object.keys(SECTION_LABELS);
  const videosBySection = sections.reduce((acc, sec) => {
    acc[sec] = videos.filter(v => v.section === sec);
    return acc;
  }, {} as Record<string, Video[]>);

  const totalVideos = videos.length;
  const completedVideos = videos.filter(v => progress.get(v.id)?.quiz_passed).length;
  const totalHours = Object.values(SECTION_HOURS).reduce((a, b) => a + b, 0);
  const pct = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;
  const allComplete = completedVideos === totalVideos && totalVideos > 0;

  const activeQuizzes = activeVideo ? (quizzes.get(activeVideo.id) ?? []) : [];

  if (loading) return <div className="p-8 text-gray-400">Loading course...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="RBT 40-Hour Training Course">
        {allComplete && (
          <Link href="/dashboard/training/certificate">
            <Button className="bg-green-600 hover:bg-green-700">🎓 Get Certificate</Button>
          </Link>
        )}
      </PageHeader>

      {/* PROGRESS BANNER */}
      <div className="bg-[#1a2234] rounded-2xl p-5 text-white">
        <div className="flex justify-between items-start flex-wrap gap-3 mb-3">
          <div>
            <p className="font-bold text-lg">BACB 2026 RBT 40-Hour Training</p>
            <p className="text-gray-300 text-sm mt-0.5">Complete all videos and score 100% on every quiz to earn your certificate.</p>
            <p className="text-yellow-300 text-xs mt-1">
              ⚠️ This training is offered independent of the BACB. A Responsible Trainer must certify completion.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-bold text-green-400">{pct}%</p>
            <p className="text-gray-400 text-xs">{completedVideos}/{totalVideos} complete</p>
          </div>
        </div>
        <div className="w-full bg-white bg-opacity-20 rounded-full h-3">
          <div className="h-3 rounded-full bg-green-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Hours", value: `${totalHours}h`, color: "text-blue-600" },
          { label: "Total Videos", value: totalVideos, color: "text-purple-600" },
          { label: "Completed", value: completedVideos, color: "text-green-600" },
          { label: "Remaining", value: totalVideos - completedVideos, color: "text-orange-500" },
        ].map(s => (
          <div key={s.label} className="border rounded-xl p-3 text-center bg-white">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ACTIVE VIDEO PLAYER */}
      {activeVideo && (
        <div className="border-2 border-blue-200 rounded-2xl overflow-hidden bg-white">
          <div className="bg-[#1a2234] px-4 py-3 flex justify-between items-center">
            <div>
              <p className="text-white font-bold">{activeVideo.title}</p>
              <p className="text-gray-400 text-xs mt-0.5">Section {activeVideo.section} — {SECTION_LABELS[activeVideo.section]}</p>
            </div>
            <button onClick={() => setActiveVideo(null)} className="text-gray-400 hover:text-white">✕</button>
          </div>

          {!showQuiz ? (
            <div>
              {activeVideo.video_url ? (
                <div className="relative bg-black">
                  <video
                    ref={videoRef}
                    src={activeVideo.video_url}
                    controls
                    controlsList="nodownload nofullscreen"
                    disablePictureInPicture
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    onEnded={handleVideoEnded}
                    onSeeking={handleSeeking}
                    style={{ width: "100%", maxHeight: "480px" }}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  {/* Overlay to prevent right-click download */}
                  <div className="absolute inset-0 pointer-events-none" />
                </div>
              ) : (
                <div className="bg-gray-900 flex items-center justify-center" style={{ height: "360px" }}>
                  <div className="text-center text-white">
                    <p className="text-4xl mb-3">🎬</p>
                    <p className="font-bold">Video Coming Soon</p>
                    <p className="text-gray-400 text-sm mt-1">This video is being generated. Check back soon.</p>
                  </div>
                </div>
              )}

              <div className="p-4">
                {activeVideo.description && (
                  <p className="text-sm text-gray-600 mb-4">{activeVideo.description}</p>
                )}

                {/* Watch progress */}
                {activeVideo.duration_seconds > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Watch progress</span>
                      <span>{Math.round((watchSeconds / activeVideo.duration_seconds) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(100, Math.round((watchSeconds / activeVideo.duration_seconds) * 100))}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 items-center">
                  {videoWatched || !activeVideo.video_url ? (
                    <Button onClick={() => setShowQuiz(true)} disabled={activeQuizzes.length === 0}>
                      {activeQuizzes.length === 0 ? "No Quiz for this video" : "📝 Take Quiz →"}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                      Watch the full video to unlock the quiz
                    </div>
                  )}
                  {progress.get(activeVideo.id)?.quiz_passed && (
                    <span className="text-green-600 text-sm font-medium">✓ Quiz passed!</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* QUIZ */
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg">Knowledge Check</h3>
                <span className="text-sm text-gray-500">{activeQuizzes.length} questions — must score 100%</span>
              </div>

              {!quizSubmitted ? (
                <div className="space-y-6">
                  {activeQuizzes.map((q, qi) => (
                    <div key={q.id} className="border border-gray-100 rounded-xl p-4">
                      <p className="font-medium text-gray-800 mb-3">
                        <span className="text-blue-600 mr-2">{qi + 1}.</span>
                        {q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <button
                            key={oi}
                            onClick={() => setQuizAnswers(prev => ({ ...prev, [qi]: oi }))}
                            className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                              quizAnswers[qi] === oi
                                ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                                : "border-gray-200 hover:border-blue-300 text-gray-700"
                            }`}
                          >
                            <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <Button
                    onClick={submitQuiz}
                    loading={submittingQuiz}
                    disabled={Object.keys(quizAnswers).length < activeQuizzes.length}
                    className="w-full"
                  >
                    Submit Quiz
                  </Button>
                  <p className="text-xs text-gray-400 text-center">
                    Answer all {activeQuizzes.length} questions before submitting
                  </p>
                </div>
              ) : (
                /* QUIZ RESULTS */
                <div className="text-center">
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    quizScore === 100 ? "bg-green-100" : "bg-red-100"
                  }`}>
                    <div>
                      <p className={`text-4xl font-bold ${quizScore === 100 ? "text-green-600" : "text-red-600"}`}>
                        {quizScore}%
                      </p>
                      <p className={`text-sm font-medium ${quizScore === 100 ? "text-green-600" : "text-red-600"}`}>
                        {quizScore === 100 ? "PASSED" : "FAILED"}
                      </p>
                    </div>
                  </div>

                  {quizScore === 100 ? (
                    <div>
                      <p className="text-xl font-bold text-green-700 mb-1">🎉 Perfect Score!</p>
                      <p className="text-gray-500 text-sm mb-6">You've mastered this section. Ready for the next video.</p>
                      <Button onClick={proceedToNext} className="w-full mb-3">
                        Continue to Next Video →
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xl font-bold text-red-700 mb-1">Not quite!</p>
                      <p className="text-gray-500 text-sm mb-2">
                        You scored {quizScore}%. You need 100% to proceed.
                      </p>
                      <p className="text-gray-400 text-xs mb-6">Review the incorrect answers below, then try again.</p>

                      {/* Show correct/incorrect */}
                      <div className="text-left space-y-3 mb-6">
                        {activeQuizzes.map((q, qi) => {
                          const userAnswer = quizAnswers[qi];
                          const isCorrect = userAnswer === q.correct_answer;
                          return (
                            <div key={q.id} className={`border rounded-xl p-3 ${isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                              <p className="text-sm font-medium text-gray-800 mb-1">
                                {isCorrect ? "✅" : "❌"} {q.question}
                              </p>
                              {!isCorrect && (
                                <div>
                                  <p className="text-xs text-red-600">Your answer: {q.options[userAnswer]}</p>
                                  <p className="text-xs text-green-700 font-medium">Correct: {q.options[q.correct_answer]}</p>
                                  {q.explanation && <p className="text-xs text-gray-600 mt-1 italic">{q.explanation}</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-3">
                        <Button onClick={retryQuiz} className="flex-1">🔄 Retry Quiz</Button>
                        <Button variant="outline" onClick={() => setShowQuiz(false)} className="flex-1">
                          ← Re-watch Video
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* NO VIDEOS YET */}
      {videos.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-5xl mb-4">🎬</p>
          <p className="text-gray-600 font-bold text-lg">No videos published yet</p>
          <p className="text-gray-400 text-sm mt-1">Videos are being created. Check back soon.</p>
          <Link href="/dashboard/training/admin">
            <Button className="mt-4">Go to Training Admin →</Button>
          </Link>
        </div>
      )}

      {/* COURSE OUTLINE */}
      {sections.map(sec => {
        const secVideos = videosBySection[sec] ?? [];
        if (secVideos.length === 0) return (
          <div key={sec} className="border border-dashed border-gray-200 rounded-2xl p-4 opacity-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-400">{sec}</div>
              <div>
                <p className="font-bold text-gray-500">{SECTION_LABELS[sec]}</p>
                <p className="text-xs text-gray-400">{SECTION_HOURS[sec]} hours · No videos yet</p>
              </div>
            </div>
          </div>
        );

        const secCompleted = secVideos.filter(v => progress.get(v.id)?.quiz_passed).length;
        const isSecOpen = activeSection === sec;

        return (
          <div key={sec} className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
            <button
              onClick={() => setActiveSection(isSecOpen ? null : sec)}
              className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                    secCompleted === secVideos.length && secVideos.length > 0
                      ? "bg-green-100 text-green-700"
                      : secCompleted > 0
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {secCompleted === secVideos.length && secVideos.length > 0 ? "✓" : sec}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{SECTION_LABELS[sec]}</p>
                    <p className="text-xs text-gray-400">{SECTION_HOURS[sec]} hours · {secVideos.length} videos · {secCompleted} completed</p>
                  </div>
                </div>
                <span className="text-gray-400">{isSecOpen ? "▲" : "▼"}</span>
              </div>
              <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-green-500 transition-all"
                  style={{ width: secVideos.length > 0 ? `${Math.round((secCompleted / secVideos.length) * 100)}%` : "0%" }} />
              </div>
            </button>

            {isSecOpen && (
              <div className="border-t border-gray-100 p-4 space-y-2">
                {secVideos.map((video, vi) => {
                  const prog = progress.get(video.id);
                  const unlocked = isUnlocked(video, videos);
                  const isActive = activeVideo?.id === video.id;

                  return (
                    <div key={video.id}
                      className={`flex items-center gap-3 border rounded-xl p-3 transition-all ${
                        isActive ? "border-blue-400 bg-blue-50" :
                        prog?.quiz_passed ? "border-green-200 bg-green-50" :
                        !unlocked ? "border-gray-100 bg-gray-50 opacity-60" :
                        "border-gray-100 bg-white hover:border-blue-200"
                      }`}
                    >
                      {/* Status icon */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 font-bold ${
                        prog?.quiz_passed ? "bg-green-500 text-white" :
                        !unlocked ? "bg-gray-200 text-gray-400" :
                        "bg-blue-100 text-blue-600"
                      }`}>
                        {prog?.quiz_passed ? "✓" : !unlocked ? "🔒" : vi + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${!unlocked ? "text-gray-400" : "text-gray-800"}`}>
                          {video.title}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                          {video.duration_seconds > 0 && (
                            <span>{Math.floor(video.duration_seconds / 60)} min</span>
                          )}
                          {prog?.quiz_passed && <span className="text-green-600 font-medium">✓ Quiz passed</span>}
                          {prog?.completed && !prog?.quiz_passed && <span className="text-orange-500">Quiz pending</span>}
                          {!unlocked && <span className="text-gray-400">Complete previous video first</span>}
                        </div>
                      </div>

                      {unlocked && (
                        <button
                          onClick={() => startVideo(video)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                            prog?.quiz_passed
                              ? "border border-green-300 text-green-600 hover:bg-green-50"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {prog?.quiz_passed ? "Review" : prog?.completed ? "Take Quiz" : "▶ Watch"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}