"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ================= TYPES ================= */

type Client = { id: string; full_name: string };

type CPTLine = {
  cpt: string;
  billed: number;
  allowed: number;
  paid: number;
  adjustment: number;
  patient_resp: number;
  denial_code: string;
  denial_reason: string;
};

type Posting = {
  id: string;
  client_id: string | null;
  insurance_provider: string;
  payer_name?: string | null;
  check_number: string | null;
  payment_date: string;

  total_billed: number;
  total_allowed: number;
  total_paid: number;
  total_adjustment: number;
  total_patient_responsibility: number;

  denial_reason: string | null;
  cpt_lines: CPTLine[];

  status: string;
  notes: string | null;
  created_at: string;
};

/* ================= CONSTANTS ================= */

const PROVIDERS = [
  "Blue Cross Blue Shield",
  "UnitedHealthcare",
  "Aetna",
  "Cigna",
  "Humana",
  "Medicaid",
  "TRICARE",
  "Other",
];

const DENIAL_CODES = [
  { code: "CO-4", desc: "Service inconsistent with modifier" },
  { code: "CO-11", desc: "Diagnosis inconsistent with procedure" },
  { code: "CO-16", desc: "Missing information" },
  { code: "CO-29", desc: "Timely filing" },
  { code: "CO-45", desc: "Exceeds fee schedule" },
  { code: "PR-1", desc: "Deductible" },
  { code: "PR-2", desc: "Co-insurance" },
  { code: "PR-3", desc: "Co-pay" },
];

const emptyLine: CPTLine = {
  cpt: "97153",
  billed: 0,
  allowed: 0,
  paid: 0,
  adjustment: 0,
  patient_resp: 0,
  denial_code: "",
  denial_reason: "",
};

const emptyForm = {
  client_id: "",
  insurance_provider: "",
  check_number: "",
  payment_date: new Date().toISOString().split("T")[0],
  notes: "",
};

/* ================= COMPONENT ================= */

export default function ERAEOBPage() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filterProvider, setFilterProvider] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState<CPTLine[]>([{ ...emptyLine }]);

  /* ================= LOAD ================= */

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientsData }, { data: postingsData }] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase
        .from("era_eob_postings")
        .select("*")
        .eq("created_by", user.id)
        .order("payment_date", { ascending: false }),
    ]);

    setClients(clientsData ?? []);
    setPostings(
      (postingsData ?? []).map((p: any) => ({
        ...p,
        cpt_lines: Array.isArray(p.cpt_lines)
          ? p.cpt_lines
          : JSON.parse(p.cpt_lines || "[]"),
      }))
    );

    setLoading(false);
  }

  /* ================= LINE OPS ================= */

  const addLine = () => setLines((p) => [...p, { ...emptyLine }]);

  const updateLine = (i: number, field: keyof CPTLine, value: any) => {
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l))
    );
  };

  const removeLine = (i: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  };

  const totals = () => ({
    billed: lines.reduce((a, b) => a + b.billed, 0),
    allowed: lines.reduce((a, b) => a + b.allowed, 0),
    paid: lines.reduce((a, b) => a + b.paid, 0),
    adjustment: lines.reduce((a, b) => a + b.adjustment, 0),
    patient_resp: lines.reduce((a, b) => a + b.patient_resp, 0),
  });

  /* ================= SAVE ================= */

  async function handleSave(status: string) {
    if (!form.insurance_provider) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const t = totals();
    const hasDenials = lines.some((l) => l.denial_code);

    const { data } = await supabase
      .from("era_eob_postings")
      .insert([
        {
          client_id: form.client_id || null,
          insurance_provider: form.insurance_provider,
          check_number: form.check_number || null,
          payment_date: form.payment_date,

          total_billed: t.billed,
          total_allowed: t.allowed,
          total_paid: t.paid,
          total_adjustment: t.adjustment,
          total_patient_responsibility: t.patient_resp,

          denial_reason:
            lines.map((l) => l.denial_reason).filter(Boolean).join("; ") ||
            null,

          cpt_lines: JSON.stringify(lines),
          status: hasDenials ? "partial_denial" : status,
          notes: form.notes || null,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (data) {
      setPostings((p) => [
        { ...data, cpt_lines: lines },
        ...p,
      ]);
    }

    setForm(emptyForm);
    setLines([{ ...emptyLine }]);
    setShowForm(false);
    setSaving(false);
  }

  /* ================= DERIVED ================= */

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  let filtered = postings;
  if (filterProvider)
    filtered = filtered.filter((p) => p.insurance_provider === filterProvider);
  if (filterStatus)
    filtered = filtered.filter((p) => p.status === filterStatus);

  const totalPaid = postings.reduce((a, b) => a + b.total_paid, 0);
  const totalBilled = postings.reduce((a, b) => a + b.total_billed, 0);

  const collectionRate =
    totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;

  const chartData = postings
    .reduce((acc: any[], p) => {
      const month = p.payment_date.slice(0, 7);
      const existing = acc.find((a) => a.month === month);

      if (existing) {
        existing.paid += p.total_paid;
        existing.billed += p.total_billed;
      } else {
        acc.push({ month, paid: p.total_paid, billed: p.total_billed });
      }

      return acc;
    }, [])
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  function statusColor(status: string) {
    if (status === "posted") return "bg-green-100 text-green-700";
    if (status === "partial_denial") return "bg-orange-100 text-orange-700";
    if (status === "denied") return "bg-red-100 text-red-700";
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-600";
  }

  /* ================= UI ================= */

  return (
    <div className="space-y-6">
      <PageHeader title="ERA / EOB Posting">
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Post ERA/EOB"}
        </Button>
      </PageHeader>

      {/* BILLING FLOW */}
      <div className="flex items-center gap-2 text-xs text-gray-400 overflow-x-auto pb-1">
        {[
          { label: "✅ Approved", href: "/dashboard/billing/approved" },
          { label: "→" },
          { label: "📄 CMS-1500", href: "/dashboard/billing/cms1500" },
          { label: "→" },
          { label: "🔌 Clearinghouse", href: "/dashboard/clearinghouse" },
          { label: "→" },
          { label: "💰 ERA/EOB", href: "" },
        ].map((step, i) => (
          step.label === "→" ? (
            <span key={i} className="text-gray-300 font-bold shrink-0">→</span>
          ) : step.href ? (
            <Link key={i} href={step.href} className="px-3 py-1.5 rounded-full border shrink-0 border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-colors">
              {step.label}
            </Link>
          ) : (
            <span key={i} className="px-3 py-1.5 rounded-full border bg-blue-600 text-white border-blue-600 shrink-0">
              {step.label}
            </span>
          )
        ))}
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Section title="">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-green-600 font-bold text-xl">
                ${totalPaid.toFixed(0)}
              </p>
              <p className="text-xs">Paid</p>
            </div>

            <div className="text-center">
              <p className="text-blue-600 font-bold text-xl">
                ${totalBilled.toFixed(0)}
              </p>
              <p className="text-xs">Billed</p>
            </div>

            <div className="text-center">
              <p className="font-bold text-xl">{collectionRate}%</p>
              <p className="text-xs">Collection</p>
            </div>

            <div className="text-center">
              <p className="text-red-500 font-bold text-xl">
                {postings.filter((p) => p.status === "partial_denial").length}
              </p>
              <p className="text-xs">Denials</p>
            </div>
          </div>
        </Section>
      </div>

      {/* CHART */}
      {chartData.length > 0 && (
        <Section title="Trend">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="billed" fill="#e5e7eb" />
              <Bar dataKey="paid" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* FILTERS */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="">All Providers</option>
          {PROVIDERS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="">All Status</option>
          <option value="posted">Posted</option>
          <option value="pending">Pending</option>
          <option value="partial_denial">Partial Denial</option>
        </select>
      </div>

      {/* CMS-1500 LINK */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-800">Post a payment from insurance?</p>
          <p className="text-xs text-blue-600 mt-0.5">When you receive an ERA or EOB from insurance, post it here to close the billing loop.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/dashboard/billing/cms1500">
            <Button variant="outline">← Back to Claims</Button>
          </Link>
        </div>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {filtered.map((p) => (
          <div key={p.id} className="border rounded-xl p-4 bg-white">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">{p.insurance_provider}</p>
                <p className="text-xs text-gray-400">
                  {p.payment_date} · {clientMap.get(p.client_id || "")}
                </p>
              </div>

              <div className="text-right">
                <p className="text-green-600 font-bold">
                  ${p.total_paid.toFixed(2)}
                </p>
                <span
                  className={`text-xs px-2 py-1 rounded ${statusColor(
                    p.status
                  )}`}
                >
                  {p.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
