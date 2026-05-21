"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Mode =
  | "notes"
  | "interventions"
  | "programs"
  | "clients"
  | "history"
  | "profile";

const sectionContent: Record<
  Mode,
  { title: string; description: string }
> = {
  notes: {
    title: "Session Notes",
    description: "Create clear ABA session notes from structured session details.",
  },
  interventions: {
    title: "Behavior Interventions",
    description: "Collect behavior data and generate intervention recommendations.",
  },
  programs: {
    title: "Skill Programs",
    description: "Create teaching programs with targets, prompting, mastery criteria.",
  },
  clients: {
    title: "Clients / Learners",
    description: "Manage learner profiles and session history.",
  },
  history: {
    title: "History",
    description: "Review past notes, behavior data, and programs.",
  },
  profile: {
    title: "Profile / Settings",
    description: "Manage account settings.",
  },
};

export default function Dashboard() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("notes");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [staffMember, setStaffMember] = useState("");

  const currentSection = sectionContent[mode];

  // AUTH + LOCAL STORAGE
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        router.replace("/login");
      }
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    const savedClients = localStorage.getItem("aba-clients");
    if (savedClients) setClients(JSON.parse(savedClients));

    const savedHistory = localStorage.getItem("aba-history");
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function generateAI() {
    setLoading(true);

    const res = await fetch("/api/generate-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, prompt }),
    });

    const data = await res.json();
    setResult(data.result);

    const updated = [
      {
        mode,
        client: "unknown",
        staffMember,
        prompt,
        result: data.result,
        date: new Date().toLocaleString(),
      },
      ...history,
    ];

    setHistory(updated);
    localStorage.setItem("aba-history", JSON.stringify(updated));

    setLoading(false);
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 220, padding: 20, background: "#111827", color: "white" }}>
        <h2>ABA AI</h2>

        <button onClick={() => setMode("notes")}>Notes</button>
        <button onClick={() => setMode("interventions")}>Interventions</button>
        <button onClick={() => setMode("programs")}>Programs</button>
        <button onClick={() => setMode("clients")}>Clients</button>
        <button onClick={() => setMode("history")}>History</button>
        <button onClick={() => setMode("profile")}>Profile</button>

        <button onClick={logOut} style={{ marginTop: 20, color: "red" }}>
          Log out
        </button>
      </aside>

      <section style={{ flex: 1, padding: 30 }}>
        <h1>{currentSection.title}</h1>
        <p>{currentSection.description}</p>

        <textarea
          placeholder="Enter prompt..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ width: "100%", height: 120 }}
        />

        <button onClick={generateAI}>
          {loading ? "Generating..." : "Generate"}
        </button>

        {result && (
          <pre style={{ marginTop: 20, whiteSpace: "pre-wrap" }}>
            {result}
          </pre>
        )}
      </section>
    </main>
  );
}