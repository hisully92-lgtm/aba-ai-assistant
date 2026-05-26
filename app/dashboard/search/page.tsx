"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";

type SearchResult = {
  id: string;
  type: "client" | "session" | "behavior" | "program" | "incident" | "waitlist";
  title: string;
  subtitle: string;
  href: string;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<SearchResult[]>([]);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("search_recent");
    if (stored) setRecent(JSON.parse(stored));
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [
      { data: clients },
      { data: sessions },
      { data: behaviors },
      { data: programs },
      { data: incidents },
      { data: waitlist },
    ] = await Promise.all([
      supabase.from("clients").select("id, full_name, diagnosis").ilike("full_name", `%${q}%`).eq("created_by", user.id).limit(5),
      supabase.from("sessions").select("id, date, notes, status").ilike("notes", `%${q}%`).eq("created_by", user.id).limit(5),
      supabase.from("behaviors").select("id, behavior_name, function_hypothesis").ilike("behavior_name", `%${q}%`).eq("created_by", user.id).limit(5),
      supabase.from("programs").select("id, program_name, goal").ilike("program_name", `%${q}%`).eq("created_by", user.id).limit(5),
      supabase.from("incident_reports").select("id, incident_type, description, incident_date").ilike("description", `%${q}%`).eq("created_by", user.id).limit(5),
      supabase.from("waitlist").select("id, full_name, status").ilike("full_name", `%${q}%`).eq("created_by", user.id).limit(5),
    ]);

    const all: SearchResult[] = [
      ...(clients ?? []).map((c: any) => ({ id: c.id, type: "client" as const, title: c.full_name, subtitle: c.diagnosis ?? "Client", href: `/dashboard/clients` })),
      ...(sessions ?? []).map((s: any) => ({ id: s.id, type: "session" as const, title: `Session — ${s.date ?? "Recent"}`, subtitle: s.notes?.slice(0, 60) ?? s.status, href: `/dashboard/history` })),
      ...(behaviors ?? []).map((b: any) => ({ id: b.id, type: "behavior" as const, title: b.behavior_name, subtitle: b.function_hypothesis ?? "Behavior", href: `/dashboard/behaviors` })),
      ...(programs ?? []).map((p: any) => ({ id: p.id, type: "program" as const, title: p.program_name, subtitle: p.goal?.slice(0, 60) ?? "Program", href: `/dashboard/programs` })),
      ...(incidents ?? []).map((i: any) => ({ id: i.id, type: "incident" as const, title: `Incident — ${i.incident_type}`, subtitle: i.description?.slice(0, 60) ?? i.incident_date, href: `/dashboard/incidents` })),
      ...(waitlist ?? []).map((w: any) => ({ id: w.id, type: "waitlist" as const, title: w.full_name, subtitle: `Waitlist — ${w.status}`, href: `/dashboard/waitlist` })),
    ];

    setResults(all);
    setSearching(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeout);
  }, [query, search]);

  function handleSelect(result: SearchResult) {
    const updated = [result, ...recent.filter((r) => r.id !== result.id)].slice(0, 8);
    setRecent(updated);
    localStorage.setItem("search_recent", JSON.stringify(updated));
    router.push(result.href);
  }

  function typeIcon(type: string) {
    if (type === "client") return "👤";
    if (type === "session") return "📋";
    if (type === "behavior") return "🧠";
    if (type === "program") return "🎯";
    if (type === "incident") return "⚠️";
    if (type === "waitlist") return "📝";
    return "🔍";
  }

  function typeBadge(type: string) {
    if (type === "client") return "bg-blue-100 text-blue-700";
    if (type === "session") return "bg-purple-100 text-purple-700";
    if (type === "behavior") return "bg-red-100 text-red-700";
    if (type === "program") return "bg-green-100 text-green-700";
    if (type === "incident") return "bg-orange-100 text-orange-700";
    if (type === "waitlist") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-600";
  }

  const displayResults = query ? results : recent;
  const isEmpty = displayResults.length === 0 && !searching;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader title="Search" />

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder="Search clients, sessions, behaviors, programs..."
          autoFocus
          className="w-full border-2 border-blue-300 rounded-xl px-4 py-4 pl-12 text-base focus:outline-none focus:border-blue-500 shadow-sm"
        />
        {query && (
          <button onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
        )}
      </div>

      {searching && (
        <div className="flex items-center gap-3 py-4">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Searching...</p>
        </div>
      )}

      {!query && recent.length > 0 && (
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Recent Searches</p>
      )}

      {isEmpty && query && (
        <div className="text-center py-12">
          <p className="text-gray-400">No results for "{query}"</p>
          <p className="text-xs text-gray-300 mt-1">Try searching by client name, behavior, or program</p>
        </div>
      )}

      <div className="space-y-2">
        {displayResults.map((result) => (
          <button key={result.id + result.type} onClick={() => handleSelect(result)}
            className="w-full text-left border border-gray-100 rounded-xl p-4 bg-white hover:shadow-md hover:border-blue-200 transition-all flex items-center gap-4">
            <span className="text-2xl">{typeIcon(result.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{result.title}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">{result.subtitle}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${typeBadge(result.type)}`}>
              {result.type}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}