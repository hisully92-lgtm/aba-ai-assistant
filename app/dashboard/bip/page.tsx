"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";

type Client = { id: string; full_name: string; diagnosis: string | null };
type BIP = {
  id: string; client_id: string; version: number; status: string;
  plan_start_date: string | null; plan_end_date: string | null;
  review_date: string | null; reauth_due_date: string | null;
  reauth_submitted: boolean; reauth_approved: boolean;
  bcba_signed: boolean; caregiver_signed: boolean;
  medical_necessity_statement: string | null;
  recommended_hours_per_week: number; lmn_obtained: boolean;
  diagnosis_code: string | null; created_at: string; updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  under_review: "bg-yellow-100 text-yellow-700",
  reauth_pending: "bg-orange-100 text-orange-700",
  expired: "bg-red-100 text-red-700",
  discontinued: "bg-red-100 text-red-600",
};

const BIP_SECTIONS = [
  "Plan Details", "Background", "Functional Behavioral Assessment",
  "Target Behavior", "Hypothesis", "Crisis", "Curricular Assessments",
  "Instructional Goals", "Monitoring Outcomes and Action Plans",
  "Service Recommendations", "Overall Comments",
];

export default function BIPDashboardPage() {
  const [bips, setBips] = useState<BIP[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [expandedBip, setExpandedBip] = useState<string | null>(null);
  const [showSections, setShowSections] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: cu } = await supabase.from("company_users")
      .select("company_id").eq("user_id", user.id)
      .eq("status", "active").limit(1).maybeSingle();

    const [{ data: clientData }, { data: bipData }] = await Promise.all([
      supabase.from("clients").select("id, full_name, diagnosis")
        .eq("company_id", cu?.company_id),
      supabase.from("behavior_intervention_plans").select("*")
        .eq("company_id", cu?.company_id)
        .order("updated_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setBips(bipData ?? []);
    setLoading(false);
  }

  function daysUntil(date: string | null): number | null {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  // Group BIPs by client
  const bipsByClient = bips.reduce((acc, bip) => {
    if (!acc[bip.client_id]) acc[bip.client_id] = [];
    acc[bip.client_id].push(bip);
    return acc;
  }, {} as Record<string, BIP[]>);

  const clientsWithBips = clients.filter(c =>
    bipsByClient[c.id]?.length > 0 &&
    (!filterClient || c.id === filterClient)
  );

  const reauthDue = bips.filter((b) => {
    const days = daysUntil(b.reauth_due_date);
    return days !== null && days <= 30 && days > 0 && !b.reauth_submitted;
  });

  const expiringSoon = bips.filter((b) => {
    const days = daysUntil(b.plan_end_date);
    return days !== null && days <= 14 && days > 0;
  });

  const stats = {
    total: bips.length,
    active: bips.filter((b) => b.status === "active").length,
    reauthPending: bips.filter((b) => b.status === "reauth_pending").length,
    unsigned: bips.filter((b) => !b.bcba_signed || !b.caregiver_signed).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Behavior Intervention Plans">
        <Link href="/dashboard/bip/new">
          <Button>+ New BIP</Button>
        </Link>
      </PageHeader>

      {/* ALERTS */}
      {reauthDue.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-bold text-orange-700 mb-2">
            ⚠️ {reauthDue.length} reauthorization{reauthDue.length > 1 ? "s" : ""} due within 30 days
          </p>
          {reauthDue.map((b) => (
            <div key={b.id} className="flex items-center justify-between text-xs text-orange-600 mt-1">
              <span>{clientMap.get(b.client_id)?.full_name} — Reauth due: {b.reauth_due_date}</span>
              <Link href={`/dashboard/bip/${b.id}`} className="underline">Review →</Link>
            </div>
          ))}
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700 mb-2">
            🚨 {expiringSoon.length} BIP{expiringSoon.length > 1 ? "s" : ""} expiring within 14 days
          </p>
          {expiringSoon.map((b) => (
            <p key={b.id} className="text-xs text-red-600">
              {clientMap.get(b.client_id)?.full_name} — Expires: {b.plan_end_date} ({daysUntil(b.plan_end_date)} days)
            </p>
          ))}
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total BIPs", value: stats.total, color: "text-blue-600" },
          { label: "Active", value: stats.active, color: "text-green-600" },
          { label: "Reauth Pending", value: stats.reauthPending, color: "text-orange-500" },
          { label: "Awaiting Signature", value: stats.unsigned, color: "text-yellow-600" },
        ].map((stat) => (
          <div key={stat.label} className="border rounded-xl p-4 text-center bg-white">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <p className="text-sm text-gray-400">{clientsWithBips.length} clients · {bips.length} BIPs</p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {!loading && clientsWithBips.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">🧠</p>
          <p className="text-gray-600 font-medium">No BIPs yet</p>
          <p className="text-gray-400 text-sm mt-1">Click "+ New BIP" to create one.</p>
        </div>
      )}

      {/* CLIENTS WITH STACKED BIPS */}
      <div className="space-y-4">
        {clientsWithBips.map(client => {
          const clientBips = (bipsByClient[client.id] ?? [])
            .filter(b => !filterStatus || b.status === filterStatus);
          if (clientBips.length === 0) return null;
          const isClientExpanded = expandedClient === client.id || expandedClient === null;

          return (
            <div key={client.id} className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
              {/* CLIENT HEADER */}
              <div
                className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#1a2234] to-[#1e3a5f] cursor-pointer"
                onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {client.full_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-white">{client.full_name}</p>
                    <p className="text-blue-300 text-xs">{client.diagnosis} · {clientBips.length} BIP{clientBips.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/bip/new?client=${client.id}`}
                    onClick={e => e.stopPropagation()}
                    className="text-xs px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors">
                    + New BIP
                  </Link>
                  <span className="text-white text-sm">{expandedClient === client.id ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* STACKED BIPS */}
              {(expandedClient === client.id || expandedClient === null) && (
                <div className="divide-y divide-gray-100">
                  {clientBips.map((bip, idx) => {
                    const reauthDays = daysUntil(bip.reauth_due_date);
                    const planDays = daysUntil(bip.plan_end_date);
                    const isReauthUrgent = reauthDays !== null && reauthDays <= 30 && !bip.reauth_submitted;
                    const isExpiring = planDays !== null && planDays <= 14;
                    const isBipExpanded = expandedBip === bip.id;

                    return (
                      <div key={bip.id} className={`${isExpiring ? "bg-red-50" : isReauthUrgent ? "bg-orange-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                        {/* BIP ROW */}
                        <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="text-center min-w-[48px]">
                              <p className="text-xs text-gray-400">v{bip.version}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[bip.status] ?? "bg-gray-100 text-gray-600"}`}>
                                {bip.status.replace("_", " ")}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-2 items-center">
                                {bip.diagnosis_code && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{bip.diagnosis_code}</span>
                                )}
                                {bip.recommended_hours_per_week > 0 && (
                                  <span className="text-xs text-gray-500">{bip.recommended_hours_per_week}h/week</span>
                                )}
                                {bip.plan_start_date && (
                                  <span className="text-xs text-gray-400">{bip.plan_start_date} → {bip.plan_end_date}</span>
                                )}
                              </div>
                              <div className="flex gap-3 mt-1 flex-wrap">
                                <span className={`text-xs ${bip.bcba_signed ? "text-green-600" : "text-orange-500"}`}>
                                  {bip.bcba_signed ? "✓" : "○"} BCBA
                                </span>
                                <span className={`text-xs ${bip.caregiver_signed ? "text-green-600" : "text-orange-500"}`}>
                                  {bip.caregiver_signed ? "✓" : "○"} Caregiver
                                </span>
                                {bip.lmn_obtained && <span className="text-xs text-green-600">✓ LMN</span>}
                                {isReauthUrgent && <span className="text-xs text-orange-600 font-medium">⚠️ Reauth in {reauthDays}d</span>}
                                {isExpiring && <span className="text-xs text-red-600 font-medium">🚨 Expires in {planDays}d</span>}
                              </div>
                            </div>
                          </div>

                          {/* BIP TOOLBAR */}
                          <div className="flex items-center gap-1 shrink-0 flex-wrap">
                            <button onClick={() => setShowSections(showSections === bip.id ? null : bip.id)}
                              className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                              📋 Sections
                            </button>
                            <Link href={`/dashboard/bip/${bip.id}`}
                              className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                              Edit
                            </Link>
                            <Link href={`/dashboard/bip/${bip.id}/review`}
                              className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                              Preview
                            </Link>
                            <Link href={`/dashboard/analytics/graphs?client=${client.id}`}
                              className="text-xs px-2 py-1.5 border border-blue-200 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                              📈 Graphs
                            </Link>
                            <button onClick={() => setExpandedBip(isBipExpanded ? null : bip.id)}
                              className="text-xs text-gray-400 hover:text-gray-600 px-1">
                              {isBipExpanded ? "▲" : "▼"}
                            </button>
                          </div>
                        </div>

                        {/* SECTIONS PANEL */}
                        {showSections === bip.id && (
                          <div className="px-5 pb-3 border-t border-gray-100">
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-2">
                              <div className="bg-[#1a2234] px-4 py-2 flex items-center justify-between">
                                <p className="text-white text-xs font-semibold">Behavior Plan Sections</p>
                                <button onClick={() => setShowSections(null)} className="text-gray-400 hover:text-white text-xs">✕</button>
                              </div>
                              <div className="divide-y divide-gray-50">
                                {BIP_SECTIONS.map((section, i) => (
                                  <Link key={section}
                                    href={`/dashboard/bip/${bip.id}?section=${encodeURIComponent(section)}`}
                                    className={`flex items-center justify-between px-4 py-2.5 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${i === 0 ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-700"}`}>
                                    <span>{section}</span>
                                    {i === 0 && <div className="w-1 h-5 bg-blue-500 rounded-full" />}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* EXPANDED BIP DETAILS */}
                        {isBipExpanded && (
                          <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {bip.medical_necessity_statement && (
                                <div className="md:col-span-2">
                                  <p className="text-xs font-semibold text-gray-500 mb-1">Medical Necessity Statement</p>
                                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{bip.medical_necessity_statement}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1">Review Date</p>
                                <p className="text-sm text-gray-700">{bip.review_date ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1">Reauth Due</p>
                                <p className={`text-sm font-medium ${isReauthUrgent ? "text-orange-600" : "text-gray-700"}`}>
                                  {bip.reauth_due_date ?? "—"}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3 flex-wrap">
                              <Link href={`/dashboard/bip/${bip.id}`}>
                                <Button variant="outline">✏️ Edit BIP</Button>
                              </Link>
                              <Link href={`/dashboard/authorizations?client=${client.id}`}>
                                <Button variant="outline">🔐 Authorizations</Button>
                              </Link>
                              <Link href={`/dashboard/analytics/graphs?client=${client.id}`}>
                                <Button variant="outline">📈 View Graphs</Button>
                              </Link>
                            </div>
                          </div>
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
    </div>
  );
}
