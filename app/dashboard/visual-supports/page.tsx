"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };

type VisualItem = {
  label: string;
  emoji: string;
  description?: string;
};

type VisualSupport = {
  id: string;
  client_id: string;
  support_type: string;
  title: string;
  content: any;
  color_scheme?: string;
  created_at: string;
};

type Timer = {
  id: number;
  label: string;
  hours: number;
  minutes: number;
  seconds: number;
  remaining: number;
  total: number;
  running: boolean;
  paused: boolean;
  done: boolean;
  endTime: number | null;
};

const EMOJIS = ["⭐","🌟","🏆","🎯","🎉","🦁","🐶","🌈","🚀","❤️","🍎","🎮","🎨","🏅","✅"];
const ACTIVITIES = ["Circle Time","Reading","Math","Art","Recess","Lunch","Therapy","Free Play","Clean Up","Transition","Homework","Dinner","Bedtime"];
const SUPPORT_TYPES = [
  { value: "first_then", label: "First-Then" },
  { value: "token_economy", label: "Token Board" },
  { value: "visual_schedule", label: "Visual Schedule" },
  { value: "choice_board", label: "Choice Board" },
];

function playJingle() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523, 659, 784, 1047]; // C E G C - happy chord
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {}
}

export default function VisualSupportsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [supports, setSupports] = useState<VisualSupport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"first-then" | "token" | "timer" | "saved" | "create">("first-then");
  const [filterClient, setFilterClient] = useState("");

  // FIRST THEN
  const [ftClient, setFtClient] = useState("");
  const [first, setFirst] = useState("");
  const [then, setThen] = useState("");
  const [firstEmoji, setFirstEmoji] = useState("⭐");
  const [thenEmoji, setThenEmoji] = useState("🎉");

  // TOKEN
  const [teClient, setTeClient] = useState("");
  const [goal, setGoal] = useState(5);
  const [tokenEmoji, setTokenEmoji] = useState("⭐");
  const [reward, setReward] = useState("");

  // TIMERS — background-safe with endTime
  const [timers, setTimers] = useState<Timer[]>([
    { id: 1, label: "Timer 1", hours: 0, minutes: 5, seconds: 0, remaining: 0, total: 0, running: false, paused: false, done: false, endTime: null }
  ]);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // CREATE
  const [createClient, setCreateClient] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("visual_schedule");
  const [items, setItems] = useState<VisualItem[]>([{ label: "", emoji: "⭐" }]);

  useEffect(() => { init(); }, []);

  // SINGLE BACKGROUND-SAFE TICK FOR ALL TIMERS
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setTimers(prev => prev.map(t => {
        if (!t.running || !t.endTime) return t;
        const remaining = Math.max(0, Math.round((t.endTime - now) / 1000));
        if (remaining === 0 && t.running) {
          playJingle();
          return { ...t, remaining: 0, running: false, done: true, endTime: null };
        }
        return { ...t, remaining };
      }));
    };

    tickRef.current = setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase.from("visual_supports").select("*").eq("created_by", user.id).order("created_at", { ascending: false })
    ]);
    setClients(c ?? []);
    setSupports(s ?? []);
    setLoading(false);
  }

  async function saveFirstThen() {
    if (!ftClient || !first || !then) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("visual_supports").insert([{
      client_id: ftClient, support_type: "first_then",
      title: `First ${first}, Then ${then}`,
      content: { first, then, firstEmoji, thenEmoji },
      created_by: user.id,
    }]).select().single();
    if (data) setSupports(prev => [data, ...prev]);
    setSaving(false);
  }

  async function saveToken() {
    if (!teClient || !reward) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("visual_supports").insert([{
      client_id: teClient, support_type: "token_economy",
      title: "Token Board",
      content: { goal, tokenEmoji, reward },
      created_by: user.id,
    }]).select().single();
    if (data) setSupports(prev => [data, ...prev]);
    setSaving(false);
  }

  function addTimer() {
    const newId = Date.now();
    setTimers(prev => [...prev, {
      id: newId, label: `Timer ${prev.length + 1}`,
      hours: 0, minutes: 5, seconds: 0,
      remaining: 0, total: 0, running: false, paused: false, done: false, endTime: null
    }]);
  }

  function startTimer(id: number) {
    setTimers(prev => prev.map(t => {
      if (t.id !== id) return t;
      const total = t.hours * 3600 + t.minutes * 60 + t.seconds;
      const endTime = Date.now() + total * 1000;
      return { ...t, total, remaining: total, running: true, paused: false, done: false, endTime };
    }));
  }

  function pauseTimer(id: number) {
    setTimers(prev => prev.map(t => {
      if (t.id !== id) return t;
      return { ...t, running: false, paused: true, endTime: null };
    }));
  }

  function resumeTimer(id: number) {
    setTimers(prev => prev.map(t => {
      if (t.id !== id) return t;
      const endTime = Date.now() + t.remaining * 1000;
      return { ...t, running: true, paused: false, endTime };
    }));
  }

  function stopTimer(id: number) {
    setTimers(prev => prev.map(t =>
      t.id === id ? { ...t, running: false, paused: false, done: false, remaining: 0, endTime: null } : t
    ));
  }

  function removeTimer(id: number) {
    stopTimer(id);
    setTimers(prev => prev.filter(t => t.id !== id));
  }

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function timerColor(timer: Timer) {
    if (!timer.total) return "bg-gray-200";
    const p = timer.remaining / timer.total;
    if (p < 0.2) return "bg-red-500";
    if (p < 0.5) return "bg-orange-400";
    return "bg-green-500";
  }

  const filtered = filterClient ? supports.filter(s => s.client_id === filterClient) : supports;

  function renderSupport(s: VisualSupport) {
    if (s.support_type === "first_then") {
      return (
        <div className="flex gap-3">
          <div className="bg-blue-50 p-3 rounded-lg text-center flex-1">
            <div className="text-2xl">{s.content.firstEmoji}</div>
            <div className="text-sm font-bold">{s.content.first}</div>
          </div>
          <div className="text-xl">→</div>
          <div className="bg-green-50 p-3 rounded-lg text-center flex-1">
            <div className="text-2xl">{s.content.thenEmoji}</div>
            <div className="text-sm font-bold">{s.content.then}</div>
          </div>
        </div>
      );
    }
    if (s.support_type === "token_economy") {
      return (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: s.content.goal ?? 5 }).map((_, i) => (
            <span key={i} className="text-xl">{s.content.tokenEmoji}</span>
          ))}
          <p className="text-xs text-gray-500 w-full mt-1">Reward: {s.content.reward}</p>
        </div>
      );
    }
    if (Array.isArray(s.content)) {
      return (
        <div className="grid grid-cols-2 gap-2">
          {s.content.map((i: VisualItem, idx: number) => (
            <div key={idx} className="bg-gray-50 p-2 rounded text-center">
              <div className="text-xl">{i.emoji}</div>
              <div className="text-xs font-bold">{i.label}</div>
            </div>
          ))}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Visual Supports" />

      {/* TABS */}
      <div className="flex gap-2 border-b text-sm">
        {["first-then","token","timer","saved","create"].map(t => (
          <button type="button" key={t} onClick={() => setTab(t as any)}
            className={`px-3 py-2 capitalize ${tab === t ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* FIRST THEN */}
      {tab === "first-then" && (
        <Section title="First Then">
          <select value={ftClient} onChange={e => setFtClient(e.target.value)} className="border p-2 rounded w-full mb-2">
            <option value="">Select client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select value={first} onChange={e => setFirst(e.target.value)} className="border p-2 rounded w-full">
              <option value="">First activity</option>
              {ACTIVITIES.map(a => <option key={a}>{a}</option>)}
            </select>
            <select value={then} onChange={e => setThen(e.target.value)} className="border p-2 rounded w-full">
              <option value="">Then activity</option>
              {ACTIVITIES.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="mt-3">
            <Button onClick={saveFirstThen} disabled={!ftClient || !first || !then} loading={saving}>Save</Button>
          </div>
        </Section>
      )}

      {/* TOKEN */}
      {tab === "token" && (
        <Section title="Token Board">
          <select value={teClient} onChange={e => setTeClient(e.target.value)} className="border p-2 rounded w-full mb-2">
            <option value="">Select client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <input value={reward} onChange={e => setReward(e.target.value)} placeholder="Reward" className="border p-2 rounded w-full mb-2" />
          <input type="range" min={1} max={20} value={goal} onChange={e => setGoal(+e.target.value)} className="w-full mb-2" />
          <div className="flex gap-1 my-2 flex-wrap">
            {Array.from({ length: goal }).map((_, i) => (
              <span key={i} className="text-2xl">{tokenEmoji}</span>
            ))}
          </div>
          <Button onClick={saveToken} disabled={!teClient || !reward} loading={saving}>Save Token Board</Button>
        </Section>
      )}

      {/* TIMER */}
      {tab === "timer" && (
        <Section title="Timers">
          <div className="space-y-4">
            {timers.map(timer => (
              <div key={timer.id} className="border rounded-xl p-4 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <input
                    value={timer.label}
                    onChange={e => setTimers(prev => prev.map(t => t.id === timer.id ? { ...t, label: e.target.value } : t))}
                    className="font-semibold text-sm border-b border-gray-300 bg-transparent focus:outline-none w-32"
                  />
                  <button type="button" onClick={() => removeTimer(timer.id)} className="text-gray-400 hover:text-red-500 text-xs">Remove</button>
                </div>

                {!timer.running && !timer.paused && !timer.done && (
                  <div className="flex items-end gap-2">
                    <div className="text-center">
                      <input type="number" min={0} max={23} value={timer.hours}
                        onChange={e => setTimers(prev => prev.map(t => t.id === timer.id ? { ...t, hours: +e.target.value } : t))}
                        className="border rounded p-1 w-16 text-center text-sm" />
                      <p className="text-xs text-gray-400 mt-0.5">hrs</p>
                    </div>
                    <span className="text-gray-400 font-bold mb-4">:</span>
                    <div className="text-center">
                      <input type="number" min={0} max={59} value={timer.minutes}
                        onChange={e => setTimers(prev => prev.map(t => t.id === timer.id ? { ...t, minutes: +e.target.value } : t))}
                        className="border rounded p-1 w-16 text-center text-sm" />
                      <p className="text-xs text-gray-400 mt-0.5">min</p>
                    </div>
                    <span className="text-gray-400 font-bold mb-4">:</span>
                    <div className="text-center">
                      <input type="number" min={0} max={59} value={timer.seconds}
                        onChange={e => setTimers(prev => prev.map(t => t.id === timer.id ? { ...t, seconds: +e.target.value } : t))}
                        className="border rounded p-1 w-16 text-center text-sm" />
                      <p className="text-xs text-gray-400 mt-0.5">sec</p>
                    </div>
                  </div>
                )}

                {(timer.running || timer.paused || timer.done) && (
                  <div className="text-center">
                    <div className={`inline-block px-6 py-3 rounded-xl text-white font-mono text-3xl font-bold ${timerColor(timer)}`}>
                      {formatTime(timer.remaining)}
                    </div>
                    {timer.done && (
                      <div className="mt-2">
                        <p className="text-green-600 font-semibold text-lg">🎉 Time is up!</p>
                        <p className="text-xs text-gray-400 mt-1">Great job!</p>
                      </div>
                    )}
                    {timer.paused && <p className="text-orange-500 text-sm mt-1">⏸ Paused</p>}
                    {timer.running && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${timerColor(timer)}`}
                          style={{ width: `${timer.total ? (timer.remaining / timer.total) * 100 : 0}%` }} />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {!timer.running && !timer.paused && !timer.done && (
                    <Button onClick={() => startTimer(timer.id)}>▶ Start</Button>
                  )}
                  {timer.running && (
                    <Button variant="outline" onClick={() => pauseTimer(timer.id)}>⏸ Pause</Button>
                  )}
                  {timer.paused && (
                    <Button onClick={() => resumeTimer(timer.id)}>▶ Resume</Button>
                  )}
                  {(timer.running || timer.paused || timer.done) && (
                    <Button variant="danger" onClick={() => stopTimer(timer.id)}>⏹ Stop</Button>
                  )}
                  {timer.done && (
                    <Button variant="outline" onClick={() => startTimer(timer.id)}>🔁 Repeat</Button>
                  )}
                </div>
              </div>
            ))}

            <button type="button" onClick={addTimer}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
              + Add Timer
            </button>
          </div>
        </Section>
      )}

      {/* SAVED */}
      {tab === "saved" && (
        <Section title="Saved">
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="border p-2 rounded w-full mb-3">
            <option value="">All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          {filtered.map(s => (
            <div key={s.id} className="border p-3 rounded mb-2">
              <div className="font-bold mb-2">{s.title}</div>
              {renderSupport(s)}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-gray-400 text-sm">No saved supports yet.</p>}
        </Section>
      )}

      {/* CREATE */}
      {tab === "create" && (
        <Section title="Create Visual Support">
          <select value={createClient} onChange={e => setCreateClient(e.target.value)} className="border p-2 rounded w-full mb-2">
            <option value="">Select client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="border p-2 rounded w-full mb-2" />
          <select value={type} onChange={e => setType(e.target.value)} className="border p-2 rounded w-full mb-3">
            {SUPPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input value={item.label} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, label: e.target.value } : it))}
                placeholder="Label" className="border p-2 rounded flex-1" />
              <select value={item.emoji} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, emoji: e.target.value } : it))}
                className="border p-2 rounded">
                {EMOJIS.map(em => <option key={em}>{em}</option>)}
              </select>
            </div>
          ))}
          <button type="button" onClick={() => setItems(prev => [...prev, { label: "", emoji: "⭐" }])}
            className="text-sm text-blue-500 underline mb-3">+ Add item</button>
        </Section>
      )}
    </div>
  );
}