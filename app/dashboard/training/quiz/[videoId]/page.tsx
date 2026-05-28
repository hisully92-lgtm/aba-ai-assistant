"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Quiz = {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  order_index: number;
};

type Video = {
  id: string;
  title: string;
  section: string;
};

export default function QuizPage({ params }: { params: { videoId: string } }) {
  const router = useRouter();
  const [video, setVideo] = useState<Video | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, [params.videoId]);

  async function init() {
    const [{ data: videoData }, { data: quizData }, { data: auth }] = await Promise.all([
      supabase.from("training_videos").select("id, title, section").eq("id", params.videoId).single(),
      supabase.from("training_quizzes").select("*").eq("video_id", params.videoId).order("order_index"),
      supabase.auth.getUser(),
    ]);

    setVideo(videoData);
    setQuizzes((quizData ?? []).map((q: any) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : JSON.parse(q.options),
    })));

    if (auth.user) {
      const { data: attemptData } = await supabase
        .from("training_quiz_attempts")
        .select("id")
        .eq("user_id", auth.user.id)
        .eq("video_id", params.videoId);
      setAttempts(attemptData?.length ?? 0);
    }

    setLoading(false);
  }

  async function handleSubmit() {
    if (Object.keys(answers).length < quizzes.length) return;
    setSubmitting(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    let correct = 0;
    quizzes.forEach((q, i) => {
      if (answers[i] === q.correct_answer) correct++;
    });

    const finalScore = Math.round((correct / quizzes.length) * 100);
    const didPass = finalScore === 100;

    setScore(finalScore);
    setPassed(didPass);
    setSubmitted(true);
    setAttempts(prev => prev + 1);

    await supabase.from("training_quiz_attempts").insert([{
      user_id: user.id,
      video_id: params.videoId,
      answers: JSON.stringify(Object.values(answers)),
      score: finalScore,
      passed: didPass,
    }]);

    const { data: existing } = await supabase
      .from("training_progress")
      .select("quiz_best_score")
      .eq("user_id", user.id)
      .eq("video_id", params.videoId)
      .single();

    const bestScore = Math.max(finalScore, existing?.quiz_best_score ?? 0);

    await supabase.from("training_progress").upsert({
      user_id: user.id,
      video_id: params.videoId,
      completed: true,
      quiz_passed: didPass,
      quiz_best_score: bestScore,
      quiz_attempts: attempts + 1,
      completed_at: didPass ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,video_id" });

    setSubmitting(false);
  }

  function retry() {
    setAnswers({});
    setSubmitted(false);
    setScore(0);
    setPassed(false);
  }

  if (loading) return <div className="p-8 text-gray-400">Loading quiz...</div>;
  if (!video) return <div className="p-8 text-red-500">Video not found.</div>;
  if (quizzes.length === 0) return (
    <div className="p-8 text-center">
      <p className="text-gray-500">No quiz questions for this video yet.</p>
      <Link href="/dashboard/training/course"><Button className="mt-4">← Back to Course</Button></Link>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Knowledge Check">
        <Link href="/dashboard/training/course">
          <Button variant="outline">← Back to Course</Button>
        </Link>
      </PageHeader>

      <div className="bg-[#1a2234] rounded-2xl p-4 text-white">
        <p className="font-bold">{video.title}</p>
        <p className="text-gray-400 text-xs mt-0.5">
          Section {video.section} · {quizzes.length} questions · Must score 100% to proceed
          {attempts > 0 && ` · ${attempts} attempt${attempts > 1 ? "s" : ""} so far`}
        </p>
      </div>

      {!submitted ? (
        <div className="space-y-5">
          {quizzes.map((q, qi) => (
            <div key={q.id} className="border border-gray-100 rounded-2xl p-5 bg-white">
              <p className="font-semibold text-gray-800 mb-4">
                <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-100 text-blue-700 rounded-full text-sm font-bold mr-2">
                  {qi + 1}
                </span>
                {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => setAnswers(prev => ({ ...prev, [qi]: oi }))}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                      answers[qi] === oi
                        ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                        : "border-gray-200 hover:border-blue-300 text-gray-700 bg-white"
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 ${
                      answers[qi] === oi ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="sticky bottom-4">
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={Object.keys(answers).length < quizzes.length}
              className="w-full text-base py-3"
            >
              Submit Quiz ({Object.keys(answers).length}/{quizzes.length} answered)
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SCORE */}
          <div className={`rounded-2xl p-8 text-center ${passed ? "bg-green-50 border-2 border-green-300" : "bg-red-50 border-2 border-red-200"}`}>
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${passed ? "bg-green-100" : "bg-red-100"}`}>
              <span className={`text-4xl font-bold ${passed ? "text-green-600" : "text-red-600"}`}>{score}%</span>
            </div>
            <p className={`text-2xl font-bold mb-1 ${passed ? "text-green-700" : "text-red-700"}`}>
              {passed ? "🎉 Perfect Score!" : "Not Quite"}
            </p>
            <p className={`text-sm ${passed ? "text-green-600" : "text-red-600"}`}>
              {passed
                ? "You've mastered this section! Continue to the next video."
                : `You scored ${score}%. You need 100% to unlock the next video.`}
            </p>
          </div>

          {/* ANSWER REVIEW */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-700">Answer Review</p>
            {quizzes.map((q, qi) => {
              const userAnswer = answers[qi];
              const isCorrect = userAnswer === q.correct_answer;
              return (
                <div key={q.id} className={`border rounded-xl p-4 ${isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <p className="text-sm font-medium text-gray-800 mb-2">
                    {isCorrect ? "✅" : "❌"} {q.question}
                  </p>
                  {!isCorrect && (
                    <div className="space-y-1">
                      <p className="text-xs text-red-600">
                        Your answer: <span className="font-medium">{q.options[userAnswer]}</span>
                      </p>
                      <p className="text-xs text-green-700 font-medium">
                        Correct answer: {q.options[q.correct_answer]}
                      </p>
                      {q.explanation && (
                        <p className="text-xs text-gray-600 mt-2 italic bg-white rounded-lg px-3 py-2">
                          💡 {q.explanation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {passed ? (
            <Link href="/dashboard/training/course">
              <Button className="w-full text-base py-3">Continue to Course →</Button>
            </Link>
          ) : (
            <div className="flex gap-3">
              <Button onClick={retry} className="flex-1">🔄 Retry Quiz</Button>
              <Link href="/dashboard/training/course" className="flex-1">
                <Button variant="outline" className="w-full">← Re-watch Video</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}