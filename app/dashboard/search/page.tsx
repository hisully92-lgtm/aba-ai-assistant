"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";

type Result = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
};

const TYPE_COLORS: Record<string, string> = {
  "Client": "bg-blue-100 text-blue-700",
  "Session Note": "bg-gray-100 text-gray-700",
  "Behavior": "bg-red-100 text-red-700",
  "Program": "bg-green-100 text-green-700",
  "Goal": "bg-purple-100 text-purple-700",
  "Incident": "bg-orange-100 text-orange-700",
  "Authorization": "bg-teal-100 text-teal-700",
};

const QUICK_LINKS = [
  { label: "All Clients", href: "/dashboard/clients", icon: "👥" },
  { label: "Session History", href: "/dashboard/history", icon: "📋" },
  { label: "Behaviors", href: "/dashboard/behaviors", icon: "🧠" },
  { label: "Goals Dashboard", href: "/dashboard/goals", icon: "🎯" },
  { label: "BIP Plans", href: "/dashboard/bip", icon: "📄" },
  { label: "Authorizations", href: "/dashboard/authorizations", icon: "🏦" },
  { label: "ABA Graphs", href: "/dashboard/analytics/graphs", icon: "📈" },
  { label: "Crisis Plans", href: "/dashboard/crisis-plans", icon: "🚨" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true);

    const [
      { data: clients },
      { data: sessions },
      { data: behaviors },
      { data: programs },
      { data: goals },
      { data: incidents },
      { data: auths },
    ] = await Promise.all([
      supabase.from("clients").select("id, full_name, diagnosis").ilike("full_name", `%${q}%`).limit(5),
      supabase.from("sessions").select("id, client_id, note, created_at").ilike("note", `%${q}%`).limit(5),
      supabase.from("behaviors").select("id, behavior_name, client_id, created_at").ilike("behavior_name", `%${q}%`).limit(5),
      supabase.from("programs").select("id, program_name, client_id, created_at").ilike("program_name", `%${q}%`).limit(5),
      supabase.from("client_goals").select("id, goal_name, client_id, status").ilike("goal_name", `%${q}%`).limit(5),
      supabase.from("incident_reports").select("id, incident_type, client_id, created_at").ilike("incident_type", `%${q}%`).limit(3),
      supabase.from("insurance_authorizations").select("id, insurance_provider, client_id, status").ilike("insurance_provider", `%${q}%`).limit(3),
    ]);

    const allResults: Result[] = [
      ...(clients ?? []).map((c: any) => ({
        id: c.id, type: "Client", icon: "👥",
        title: c.full_name,
        subtitle: c.diagnosis ?? "No diagnosis listed",
        href: "/dashboard/clients",
      })),
      ...(sessions ?? []).map((s: any) => ({
        id: s.id, type: "Session Note", icon: "📋",
        title: `Session — ${new Date(s.created_at).toLocaleDateString()}`,
        subtitle: (s.note ?? "").slice(0, 80) + "...",
        href: "/dashboard/history",
      })),
      ...(behaviors ?? []).map((b: any) => ({
        id: b.id, type: "Behavior", icon: "🧠",
        title: b.behavior_name,
        subtitle: `Logged ${new Date(b.created_at).toLocaleDateString()}`,
        href: "/dashboard/behaviors",
      })),
      ...(programs ?? []).map((p: any) => ({
        id: p.id, type: "Program", icon: "🎯",
        title: p.program_name,
        subtitle: `Created ${new Date(p.created_at).toLocaleDateString()}`,
        href: "/dashboard/programs",
      })),
      ...(goals ?? []).map((g: any) => ({
        id: g.id, type: "Goal", icon: "✅",
        title: g.goal_name,
        subtitle: `Status: ${g.status}`,
        href: "/dashboard/goals",
      })),
      ...(incidents ?? []).map((i: any) => ({
        id: i.id, type: "Incident", icon: "⚠️",
        title: i.incident_type,
        subtitle: `Reported ${new Date(i.created_at).toLocaleDateString()}`,
        href: "/dashboard/incidents",
      })),
      ...(auths ?? []).map((a: any) => ({
        id: a.id, type: "Authorization", icon: "🏦",
        title: a.insurance_provider,
        subtitle: `Status: ${a.status}`,
        href: "/dashboard/authorizations",
      })),
    ];

    setResults(allResults);
    setSearched(true);
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Search" />

      {/* SEARCH BAR */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search clients, sessions, behaviors, programs, goals..."
          autoFocus
          className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 pl-12 text-base focus:outline-none focus:border-blue-400"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {query && !loading && (
          <button onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            ✕
          </button>
        )}
      </div>

      {/* NO RESULTS */}
      {searched && results.length === 0 && (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-gray-600 font-medium">No results for "{query}"</p>
          <p className="text-gray-400 text-sm mt-1">Try a client name, behavior, program, or goal</p>
        </div>
      )}

      {/* RESULTS */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">{results.length} results for "{query}"</p>
          {results.map((result) => (
            <Link key={result.id + result.type} href={result.href}>
              <div className="flex items-center gap-3 border border-gray-100 rounded-xl p-4 bg-white hover:shadow-sm hover:border-blue-200 transition-all cursor-pointer">
                <span className="text-2xl">{result.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{result.title}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{result.subtitle}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${TYPE_COLORS[result.type] ?? "bg-gray-100 text-gray-600"}`}>
                  {result.type}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* QUICK LINKS — shown when no search active */}
      {!searched && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Quick Links</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="flex items-center gap-3 border border-gray-100 rounded-xl p-3 bg-white hover:shadow-sm hover:border-blue-200 transition-all cursor-pointer">
                  <span className="text-xl">{link.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{link.label}</span>
                  <span className="ml-auto text-gray-300">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}