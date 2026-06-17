"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TimeEntry = {
  id: string; client_id: string; date: string;
  start_time: string; end_time: string; duration_minutes: number;
  session_type: string; cpt_code: string | null;
  drive_time_minutes: number; drive_time_billable: boolean;
  status: string; approved_at: string | null; billed_at: string | null;
  location_name: string | null;
  insurance_provider?: string | null;
  clients?: { full_name: string };
  profiles?: { full_name: string };
};

export default function ApprovedBillingPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"approved" | "billed">("approved");

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data: cu } = await supabase.from("company_users").select("company_id")
      .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    setCompanyId(cu?.company_id ?? "");
    await loadEntries(cu?.company_id);
  }

  async function loadEntries(cId?: string) {
    const { data } = await supabase
      .from("time_entry_logs")
      .select("*, clients(full_name)")
      .eq("company_id", cId ?? companyId)
      .in("status", ["approved", "billed"])
      .order("approved_at", { ascending: false })
      .limit(200);
    setEntries(data ?? []);
    setLoading(false);
  }

  async function markBilled(ids: string[]) {
    setSaving("billing");
    await Promise.all(ids.map(id =>
      supabase.from("time_entry_logs").update({
        status: "billed", billed_at: new Date().toISOString(),
      }).eq("id", id)
    ));
    setSelected([]);
    await loadEntries();
    setSaving(null);
  }

  function generateCMS1500(entry: TimeEntry) {
    const params = new URLSearchParams({
      client_id: entry.client_id,
      client_name: entry.clients?.full_name ?? "",
      cpt_code: entry.cpt_code ?? "97153",
      date: entry.date,
      duration_minutes: String(entry.duration_minutes),
      session_type: entry.session_type,
      location: entry.location_name ?? "",
      time_entry_id: entry.id,
    });
    router.push(`/dashboard/billing/cms1500?${params.toString()}`);
  }

  function exportCSV() {
    const rows = filtered.map(e => [
      e.clients?.full_name ?? "",
      e.date,
      e.start_time ? new Date(e.start_time).toLocaleTimeString() : "",
      e.end_time ? new Date(e.end_time).toLocaleTimeString() : "",
      e.duration_minutes,
      e.session_type,
      e.cpt_code ?? "",
      e.drive_time_minutes,
      e.drive_time_billable ? "Yes" : "No",
      e.status,
      e.location_name ?? "",
    ]);
    const header = ["Client", "Date", "Start", "End", "Duration (min)", "Session Type", "CPT Code", "Drive Time (min)", "Drive Billable", "Status", "Location"];
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  const fmt = (m: number) => { const h = Math.floor(m / 60); const min = m % 60; return h > 0 ? `${h}h ${min}m` : `${min}m`; };
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  const filtered = entries.filter(e => e.status === activeTab);
  const approvedCount = entries.filter(e => e.status === "approved").length;
  const billedCount = entries.filter(e => e.status === "billed").length;
  const totalApprovedMinutes = entries.filter(e => e.status === "approved").reduce((sum, e) => sum + e.duration_minutes, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing">
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>📥 Export CSV</Button>
          <Link href="/dashboard/billing/cms1500">
            <Button variant="outline">📄 CMS-1500 Claims</Button>
          </Link>
          <Link href="/dashboard/session-review">
            <Button variant="outline">‹ Review Queue</Button>
          </Link>
        </div>
      </PageHeader>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Ready to Bill", val: approvedCount, color: "bg-green-50 border-green-100 text-green-700" },
          { label: "Total Hours Ready", val: `${Math.floor(totalApprovedMinutes / 60)}h ${totalApprovedMinutes % 60}m`, color: "bg-blue-50 border-blue-100 text-blue-700" },
          { label: "Billed This Period", val: billedCount, color: "bg-purple-50 border-purple-100 text-purple-700" },
          { label: "Selected", val: selected.length, color: "bg-yellow-50 border-yellow-100 text-yellow-700" },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-4 ${s.color}`}>
            <p className="text-xs font-semibold uppercase">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {/* BULK ACTIONS */}
      {selected.length > 0 && activeTab === "approved" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-blue-800">{selected.length} entries selected</p>
          <div className="flex gap-2">
            <Button onClick={() => markBilled(selected)} loading={saving === "billing"}>
              💰 Mark {selected.length} as Billed
            </Button>
            <Button variant="outline" onClick={() => setSelected([])}>Clear</Button>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="flex border-b border-gray-200">
        {[
          { key: "approved", label: `Ready to Bill (${approvedCount})` },
          { key: "billed", label: `Billed History (${billedCount})` },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">{activeTab === "approved" ? "✅" : "💰"}</p>
          <p className="font-semibold text-gray-700">{activeTab === "approved" ? "No entries ready to bill" : "No billed entries yet"}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(entry => (
          <div key={entry.id} className={`border rounded-xl bg-white p-4 flex items-center gap-4 ${selected.includes(entry.id) ? "border-blue-400 bg-blue-50" : "border-gray-100"}`}>
            {activeTab === "approved" && (
              <input type="checkbox" checked={selected.includes(entry.id)}
                onChange={e => setSelected(prev => e.target.checked ? [...prev, entry.id] : prev.filter(id => id !== entry.id))}
                className="w-4 h-4 rounded border-gray-300" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="font-semibold text-gray-800">{entry.clients?.full_name ?? "Unknown"}</p>
                {entry.cpt_code && <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{entry.cpt_code}</span>}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span>📅 {entry.date}</span>
                <span>⏱️ {fmt(entry.duration_minutes)}</span>
                <span>{entry.session_type}</span>
                {entry.drive_time_minutes > 0 && <span>🚗 {entry.drive_time_minutes}min{entry.drive_time_billable ? " (billable)" : ""}</span>}
                {entry.location_name && <span>📍 {entry.location_name}</span>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => generateCMS1500(entry)}>
                📄 CMS-1500
              </Button>
              {activeTab === "approved" && (
                <Button onClick={() => markBilled([entry.id])} loading={saving === entry.id}>
                  Bill
                </Button>
              )}
              {activeTab === "billed" && entry.billed_at && (
                <span className="text-xs text-gray-400">Billed {fmtDate(entry.billed_at)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}