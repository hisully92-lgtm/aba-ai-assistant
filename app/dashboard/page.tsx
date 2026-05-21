"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function Dashboard() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.replace("/login");
    }
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function generateAI() {
    setLoading(true);
    const res = await fetch("/api/generate-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "notes", prompt }),
    });
    const data = await res.json();
    setResult(data.result);
    setLoading(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Session Notes</h1>
      <p className="text-gray-500 mb-6">Create clear ABA session notes from structured session details.</p>
      <textarea
        placeholder="Enter prompt..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full h-32 border rounded p-2 mb-4"
      />
      <button onClick={generateAI} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        {loading ? "Generating..." : "Generate"}
      </button>
      {result && <pre className="mt-6 whitespace-pre-wrap">{result}</pre>}
    </div>
  );
}