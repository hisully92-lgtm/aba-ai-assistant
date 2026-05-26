"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type VisualSupport = {
  id: string;
  client_id: string;
  support_type: string;
  title: string;
  content: Record<string, any>;
  created_at: string;
};

const EMOJI_OPTIONS = ["⭐", "🌟", "🏆", "🎯", "🎉", "🦁", "🐶", "🌈", "🚀", "❤️", "🍎", "🎮", "🎨", "🏅", "✅"];
const ACTIVITIES = ["Circle Time", "Reading", "Math", "Art", "Recess", "Lunch", "Therapy", "Free Play", "Clean Up", "Transition", "Bath Time", "Homework", "Dinner", "Bedtime"];

export default function VisualSupportsPage() {
  const [supports, setSupports] = useState<VisualSupport[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"first-then" | "token" | "timer" | "saved">("first-then");
  const [filterClient, setFilterClient] = useState("");
  const [saving, setSaving] = useState(false);

  // First-Then state
  const [ftClientId, setFtClientId] = useState("");
  const [firstActivity, setFirstActivity] = useState("");
  const [thenActivity, setThenActivity] = useState("");
  const [firstEmoji, setFirstEmoji] = useState("⭐");
  const [thenEmoji, setThenEmoji] = useState("🎉");

  // Token Economy state
  const [teClientId, setTeClientId] = useState("");
  const [teTitle, setTeTitle] = useState("My Token Board");
  const [tokenGoal, setTokenGoal] = useState(5);
  const [tokenEmoji, setTokenEmoji] = useState("⭐");
  const [rewardText, setRewardText] = useState("");
  const [tokensEarned, setTokensEarned] = useState(0);

  // Visual Timer state
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(300);
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (timerRunning && remainingSeconds > 0) {
      timerRef.current = setTimeout(() => setRemainingSeconds((s) => s - 1), 1000);
    } else if (timerRunning && remainingSeconds === 0) {
      setTimerRunning(false);
      setTimerDone(true);
    }
    return () => clearTimeout(timerRef.current!);
  }, [timerRunning, remainingSeconds]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: supportData }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      supabase.from("visual_supports").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setSupports((supportData ?? []).map((s: any) => ({ ...s, content: typeof s.content === "object" ? s.content : JSON.parse(s.content || "{}") })));
    setLoading(false);
  }

  async function saveFirstThen() {
    if (!ftClientId || !firstActivity || !thenActivity) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("visual_supports").insert([{
      client_id: ftClientId,
      support_type: "first_then",
      title: `First ${firstActivity}, Then ${thenActivity}`,
      content: { firstActivity, thenActivity, firstEmoji, thenEmoji },
      created_by: user.id,
    }]).select().single();

    if (data) setSupports((prev) => [{ ...data, content: { firstActivity, thenActivity, firstEmoji, thenEmoji } }, ...prev]);
    setSaving(false);
  }

  async function saveTokenBoard() {
    if (!teClientId || !rewardText) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase.from("visual_supports").insert([{
      client_id: teClientId,
      support_type: "token_economy",
      title: teTitle,
      content: { tokenGoal, tokenEmoji, rewardText },
      created_by: user.id,
    }]).select().single();

    if (data) setSupports((prev) => [{ ...data, content: { tokenGoal, tokenEmoji, rewardText } }, ...prev]);
    setSaving(false);
  }

  function startTimer() {
    const total = timerMinutes * 60 + timerSeconds;
    setTotalSeconds(total);
    setRemainingSeconds(total);
    setTimerDone(false);
    setTimerRunning(true);
  }

  function timerPercent() {
    return totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0;
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const filtered = filterClient ? supports.filter((s) => s.client_id === filterClient) : supports;
  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  async function handleDelete(id: string) {
    await supabase.from("visual_supports").delete().eq("id", id);
    setSupports((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Visual Supports">
        <p className="text-gray-500 text-sm">First-Then boards, token economies, and visual timers.</p>
      </PageHeader>

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[
          { key: "first-then", label: "🎯 First-Then Board" },
          { key: "token", label: "⭐ Token Economy" },
          { key: "timer", label: "⏱ Visual Timer" },
          { key: "saved", label: `💾 Saved (${supports.length})` },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* FIRST-THEN BOARD */}
      {activeTab === "first-then" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
              <select value={ftClientId} onChange={(e) => setFtClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
          </div>

          {/* FIRST-THEN PREVIEW */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border-2 border-blue-300 rounded-2xl p-6 text-center bg-blue-50">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">FIRST</p>
              <div className="text-6xl mb-3">{firstEmoji}</div>
              <div className="flex flex-wrap gap-1 justify-center mb-3">
                {EMOJI_OPTIONS.map((e) => (
                  <button key={e} onClick={() => setFirstEmoji(e)}
                    className={`text-lg p-1 rounded ${firstEmoji === e ? "bg-blue-200" : "hover:bg-blue-100"}`}>{e}</button>
                ))}
              </div>
              <select value={firstActivity} onChange={(e) => setFirstActivity(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Select activity...</option>
                {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {firstActivity && <p className="text-lg font-bold text-blue-800 mt-2">{firstActivity}</p>}
            </div>

            <div className="border-2 border-green-300 rounded-2xl p-6 text-center bg-green-50">
              <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3">THEN</p>
              <div className="text-6xl mb-3">{thenEmoji}</div>
              <div className="flex flex-wrap gap-1 justify-center mb-3">
                {EMOJI_OPTIONS.map((e) => (
                  <button key={e} onClick={() => setThenEmoji(e)}
                    className={`text-lg p-1 rounded ${thenEmoji === e ? "bg-green-200" : "hover:bg-green-100"}`}>{e}</button>
                ))}
              </div>
              <select value={thenActivity} onChange={(e) => setThenActivity(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Select reward...</option>
                {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {thenActivity && <p className="text-lg font-bold text-green-800 mt-2">{thenActivity}</p>}
            </div>
          </div>

          <Button onClick={saveFirstThen} loading={saving} disabled={!ftClientId || !firstActivity || !thenActivity}>
            💾 Save First-Then Board
          </Button>
        </div>
      )}

      {/* TOKEN ECONOMY */}
      {activeTab === "token" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
              <select value={teClientId} onChange={(e) => setTeClientId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Board Title</label>
              <input type="text" value={teTitle} onChange={(e) => setTeTitle(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Tokens Needed: {tokenGoal}</label>
              <input type="range" min={1} max={20} value={tokenGoal} onChange={(e) => setTokenGoal(parseInt(e.target.value))}
                className="w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Reward</label>
              <input type="text" value={rewardText} onChange={(e) => setRewardText(e.target.value)}
                placeholder="e.g. 10 minutes of iPad time"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* TOKEN PREVIEW */}
          <div className="border-2 border-yellow-300 rounded-2xl p-6 bg-yellow-50">
            <p className="text-center text-xl font-bold text-yellow-800 mb-4">{teTitle}</p>
            <div className="flex flex-wrap gap-1 justify-center mb-4">
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} onClick={() => setTokenEmoji(e)}
                  className={`text-xl p-1.5 rounded-lg ${tokenEmoji === e ? "bg-yellow-300" : "hover:bg-yellow-200"}`}>{e}</button>
              ))}
            </div>

            {/* LIVE TOKEN BOARD */}
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {Array.from({ length: tokenGoal }).map((_, i) => (
                <button key={i} onClick={() => setTokensEarned(i < tokensEarned ? i : i + 1)}
                  className={`text-3xl transition-all ${i < tokensEarned ? "opacity-100 scale-110" : "opacity-20"}`}>
                  {tokenEmoji}
                </button>
              ))}
            </div>

            <p className="text-center text-sm text-yellow-700 font-medium">
              {tokensEarned}/{tokenGoal} tokens
              {tokensEarned >= tokenGoal && rewardText && ` 🎉 Earn: ${rewardText}!`}
            </p>

            <div className="flex gap-2 justify-center mt-3">
              <Button variant="outline" onClick={() => setTokensEarned((t) => Math.min(tokenGoal, t + 1))}>
                + Token
              </Button>
              <Button variant="outline" onClick={() => setTokensEarned(0)}>Reset</Button>
            </div>
          </div>

          <Button onClick={saveTokenBoard} loading={saving} disabled={!teClientId || !rewardText}>
            💾 Save Token Board
          </Button>
        </div>
      )}

      {/* VISUAL TIMER */}
      {activeTab === "timer" && (
        <Section title="Visual Timer">
          <div className="text-center space-y-6 py-4 max-w-sm mx-auto">
            {!timerRunning && !timerDone && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Minutes</label>
                  <input type="number" min={0} max={60} value={timerMinutes} onChange={(e) => setTimerMinutes(parseInt(e.target.value) || 0)}
                    className="w-full border rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Seconds</label>
                  <input type="number" min={0} max={59} value={timerSeconds} onChange={(e) => setTimerSeconds(parseInt(e.target.value) || 0)}
                    className="w-full border rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
            )}

            {/* CIRCULAR TIMER */}
            {(timerRunning || timerDone) && (
              <div className="relative w-48 h-48 mx-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle cx="50" cy="50" r="45" fill="none"
                    stroke={timerDone ? "#16a34a" : remainingSeconds < 30 ? "#dc2626" : "#2563eb"}
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - timerPercent() / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s linear" }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  {timerDone ? (
                    <p className="text-4xl">🎉</p>
                  ) : (
                    <p className="text-3xl font-bold text-gray-800">{formatTime(remainingSeconds)}</p>
                  )}
                </div>
              </div>
            )}

            {timerDone && <p className="text-xl font-bold text-green-600">Time's up! Great job! 🎉</p>}

            <div className="flex gap-3 justify-center">
              {!timerRunning && (
                <Button onClick={startTimer} disabled={timerMinutes === 0 && timerSeconds === 0}>
                  ▶ Start Timer
                </Button>
              )}
              {timerRunning && (
                <Button variant="danger" onClick={() => { setTimerRunning(false); clearTimeout(timerRef.current!); }}>
                  ⏸ Pause
                </Button>
              )}
              {(timerRunning || timerDone) && (
                <Button variant="outline" onClick={() => { setTimerRunning(false); setTimerDone(false); setRemainingSeconds(totalSeconds); }}>
                  Reset
                </Button>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* SAVED SUPPORTS */}
      {activeTab === "saved" && (
        <>
          <div className="flex gap-3 items-center">
            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">All Clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            <p className="text-sm text-gray-400">{filtered.length} supports</p>
          </div>

          {filtered.length === 0 && (
            <Section title="Saved Supports">
              <p className="text-gray-400 text-sm">No visual supports saved yet.</p>
            </Section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((support) => (
              <div key={support.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{support.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {clientMap.get(support.client_id) ?? "Unknown"} ·
                      {support.support_type === "first_then" ? " First-Then Board" : " Token Economy"}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(support.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>

                {support.support_type === "first_then" && (
                  <div className="flex gap-3 mt-3">
                    <div className="flex-1 bg-blue-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-blue-500 font-bold">FIRST</p>
                      <p className="text-2xl">{support.content.firstEmoji}</p>
                      <p className="text-xs font-medium text-blue-800">{support.content.firstActivity}</p>
                    </div>
                    <div className="flex items-center text-gray-400 text-xl">→</div>
                    <div className="flex-1 bg-green-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-green-500 font-bold">THEN</p>
                      <p className="text-2xl">{support.content.thenEmoji}</p>
                      <p className="text-xs font-medium text-green-800">{support.content.thenActivity}</p>
                    </div>
                  </div>
                )}

                {support.support_type === "token_economy" && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: support.content.tokenGoal ?? 5 }).map((_, i) => (
                        <span key={i} className="text-xl">{support.content.tokenEmoji ?? "⭐"}</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Reward: {support.content.rewardText}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}