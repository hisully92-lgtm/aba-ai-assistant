"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";

type Client = { id: string; full_name: string; diagnosis: string | null };
type BIP = {
  id: string;
  client_id: string;
  version: number;
  status: string;
  plan_start_date: string | null;
  plan_end_date: string | null;
  review_date: string | null;
  reauth_due_date: string | null;
  reauth_submitted: boolean;
  reauth_approved: boolean;
  bcba_signed: boolean;
  caregiver_signed: boolean;
  medical_necessity_statement: string | null;
  recommended_hours_per_week: number;
  lmn_obtained: boolean;
  diagnosis_code: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  under_review: "bg-yellow-100 text-yellow-700",
  reauth_pending: "bg-orange-100 text-orange-700",
  expired: "bg-red-100 text-red-700",
  discontinued: "bg-red-100 text-red-600",
};

export default function BIPDashboardPage() {
  const [bips, setBips] = useState<BIP[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: bipData }] = await Promise.all([
      supabase.from("clients").select("id, full_name, diagnosis"),
      supabase.from("behavior_intervention_plans").select("*").eq("created_by", user.id).order("updated_at", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setBips(bipData ?? []);
    setLoading(false);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  function daysUntil(date: string | null): number | null {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  let filtered = bips;
  if (filterStatus) filtered = filtered.filter((b) => b.status === filterStatus);
  if (filterClient) filtered = filtered.filter((b) => b.client_id === filterClient);

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
              <Link href={`/dashboard/bip/${b.id}`}>
                <span className="underline">Review →</span>
              </Link>
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

      {/* REAUTH CHECKLIST */}
      <Section title="📋 Reauthorization Checklist">
        <p className="text-xs text-gray-500 mb-3">Submit reauth packets 2–4 weeks before authorization expiration to prevent service gaps.</p>
        <div className="space-y-2">
          {[
            { item: "Updated progress data with graphs showing measurable progress", doc: "Visual Analytics" },
            { item: "BIP modifications addressing mastered skills and emerging behaviors", doc: "BIP Builder" },
            { item: "Medical necessity statement with recommended hours", doc: "BIP Builder" },
            { item: "Letter of Medical Necessity (LMN) signed by physician", doc: "LMN section" },
            { item: "Current diagnosis documentation (ICD-10)", doc: "Client Profile" },
            { item: "Caregiver training documentation and proof of collaboration", doc: "BIP Training" },
            { item: "BCBA credentials and NPI verification", doc: "Credentials" },
            { item: "Updated assessment results (VB-MAPP, ABLLS-R, FBA)", doc: "Assessments" },
            { item: "Session data supporting continued medical necessity", doc: "Session Notes" },
            { item: "Submitted to insurance portal or clearinghouse", doc: "Authorizations" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 border border-gray-100 rounded-lg p-3 bg-white text-sm">
              <div className="w-5 h-5 rounded border-2 border-gray-300 shrink-0" />
              <span className="flex-1 text-gray-700">{item.item}</span>
              <span className="text-xs text-blue-500 shrink-0">{item.doc}</span>
            </div>
          ))}
        </div>
      </Section>

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
        <p className="text-sm text-gray-400">{filtered.length} BIPs</p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <Section title="No BIPs Yet">
          <p className="text-gray-400 text-sm">No behavior intervention plans found. Click "+ New BIP" to create one.</p>
        </Section>
      )}

      {/* BIP LIST */}
      <div className="space-y-3">
        {filtered.map((bip) => {
          const client = clientMap.get(bip.client_id);
          const reauthDays = daysUntil(bip.reauth_due_date);
          const planDays = daysUntil(bip.plan_end_date);
          const isReauthUrgent = reauthDays !== null && reauthDays <= 30 && !bip.reauth_submitted;
          const isExpiring = planDays !== null && planDays <= 14;

          return (
            <div key={bip.id} className={`border rounded-xl bg-white ${isExpiring ? "border-red-200" : isReauthUrgent ? "border-orange-200" : "border-gray-100"}`}>
              <div className="p-4">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-800">{client?.full_name ?? "Unknown"}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[bip.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {bip.status.replace("_", " ")}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">v{bip.version}</span>
                      {bip.diagnosis_code && (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{bip.diagnosis_code}</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {bip.plan_start_date && <span>Start: {bip.plan_start_date}</span>}
                      {bip.plan_end_date && <span>End: {bip.plan_end_date}</span>}
                      {bip.recommended_hours_per_week > 0 && <span>{bip.recommended_hours_per_week}h/week</span>}
                    </div>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {bip.bcba_signed && <span className="text-xs text-green-600">✓ BCBA Signed</span>}
                      {!bip.bcba_signed && <span className="text-xs text-orange-500">○ BCBA Unsigned</span>}
                      {bip.caregiver_signed && <span className="text-xs text-green-600">✓ Caregiver Signed</span>}
                      {!bip.caregiver_signed && <span className="text-xs text-orange-500">○ Caregiver Unsigned</span>}
                      {bip.lmn_obtained && <span className="text-xs text-green-600">✓ LMN Obtained</span>}
                    </div>
                    {isReauthUrgent && (
                      <p className="text-xs text-orange-600 font-medium mt-1">
                        ⚠️ Reauth due in {reauthDays} days — submit packet now
                      </p>
                    )}
                    {bip.reauth_submitted && !bip.reauth_approved && (
                      <p className="text-xs text-blue-600 mt-1">🔄 Reauth submitted — awaiting approval</p>
                    )}
                    {bip.reauth_approved && (
                      <p className="text-xs text-green-600 mt-1">✓ Reauth approved</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/dashboard/bip/${bip.id}`}>
                      <Button variant="outline">View / Edit</Button>
                    </Link>
                    <Link href={`/dashboard/bip/${bip.id}/review`}>
                      <Button variant="outline">Review</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}