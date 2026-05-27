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

const EMOJIS = ["⭐","🌟","🏆","🎯","🎉","🦁","🐶","🌈","🚀","❤️","🍎","🎮","🎨","🏅","✅"];
const ACTIVITIES = ["Circle Time","Reading","Math","Art","Recess","Lunch","Therapy","Free Play","Clean Up","Transition","Homework","Dinner","Bedtime"];

const SUPPORT_TYPES = [
  { value: "first_then", label: "First-Then" },
  { value: "token_economy", label: "Token Board" },
  { value: "visual_schedule", label: "Visual Schedule" },
  { value: "choice_board", label: "Choice Board" },
];

const COLOR = {
  blue: "bg-blue-50 border-blue-200 text-blue-700",
  green: "bg-green-50 border-green-200 text-green-700",
  purple: "bg-purple-50 border-purple-200 text-purple-700",
};

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
  const [earned, setEarned] = useState(0);

  // TIMER
  const [min, setMin] = useState(5);
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // CREATE (advanced)
  const [createClient, setCreateClient] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("visual_schedule");
  const [items, setItems] = useState<VisualItem[]>([{ label: "", emoji: "⭐" }]);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (running && remaining > 0) {
      timerRef.current = setTimeout(() => setRemaining(r => r - 1), 1000);
    } else if (running && remaining === 0) {
      setRunning(false);
      setDone(true);
    }
    return () => clearTimeout(timerRef.current!);
  }, [running, remaining]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("clients").select("id, full_name").eq("created_by", user.id),
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
      client_id: ftClient,
      support_type: "first_then",
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
      client_id: teClient,
      support_type: "token_economy",
      title: "Token Board",
      content: { goal, tokenEmoji, reward },
      created_by: user.id,
    }]).select().single();

    if (data) setSupports(prev => [data, ...prev]);
    setSaving(false);
  }

  function startTimer() {
    const t = min * 60 + sec;
    setTotal(t);
    setRemaining(t);
    setDone(false);
    setRunning(true);
  }

  function color(value: number) {
    if (!total) return "bg-gray-100";
    const p = value / total;
    if (p > 0.8) return "bg-red-600";
    if (p > 0.5) return "bg-orange-400";
    return "bg-yellow-300";
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
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-3 py-2 ${tab === t ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* FIRST THEN */}
      {tab === "first-then" && (
        <Section title="First → Then">
          <select value={ftClient} onChange={e => setFtClient(e.target.value)} className="border p-2 rounded w-full mb-2">
            <option value="">Select client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <select value={first} onChange={e => setFirst(e.target.value)} className="border p-2 rounded w-full">
                <option value="">First activity</option>
                {ACTIVITIES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <select value={then} onChange={e => setThen(e.target.value)} className="border p-2 rounded w-full">
                <option value="">Then activity</option>
                {ACTIVITIES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <Button onClick={saveFirstThen} disabled={!ftClient || !first || !then} loading={saving}>
            Save
          </Button>
        </Section>
      )}

      {/* TOKEN */}
      {tab === "token" && (
        <Section title="Token Board">
          <select value={teClient} onChange={e => setTeClient(e.target.value)} className="border p-2 rounded w-full mb-2">
            <option>Select client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>

          <input value={reward} onChange={e => setReward(e.target.value)} placeholder="Reward" className="border p-2 rounded w-full mb-2" />

          <input type="range" min={1} max={20} value={goal} onChange={e => setGoal(+e.target.value)} />

          <div className="flex gap-1 my-2">
            {Array.from({ length: goal }).map((_, i) => (
              <span key={i} className="text-2xl">{tokenEmoji}</span>
            ))}
          </div>

          <Button onClick={saveToken} disabled={!teClient || !reward} loading={saving}>
            Save Token Board
          </Button>
        </Section>
      )}

      {/* TIMER */}
      {tab === "timer" && (
        <Section title="Timer">
          {!running && !done && (
            <div className="flex gap-2">
              <input type="number" value={min} onChange={e => setMin(+e.target.value)} className="border p-2 w-20" />
              <input type="number" value={sec} onChange={e => setSec(+e.target.value)} className="border p-2 w-20" />
            </div>
          )}

          {(running || done) && (
            <div className="text-2xl font-bold">{remaining}s</div>
          )}

          <div className="flex gap-2 mt-2">
            <Button onClick={startTimer}>Start</Button>
            <Button variant="danger" onClick={() => setRunning(false)}>Pause</Button>
          </div>
        </Section>
      )}

      {/* SAVED */}
      {tab === "saved" && (
        <Section title="Saved">
          {filtered.map(s => (
            <div key={s.id} className="border p-3 rounded mb-2">
              <div className="font-bold">{s.title}</div>
              {renderSupport(s)}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}