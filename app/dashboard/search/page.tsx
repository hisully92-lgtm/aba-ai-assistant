"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

type ERAPosting = {
  id: string;
  client_id: string | null;
  insurance_provider: string;
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
  { code: "CO-16", desc: "Claim/service lacks information" },
  { code: "CO-29", desc: "Time limit expired" },
  { code: "CO-45", desc: "Charge exceeds fee schedule" },
  { code: "CO-97", desc: "Benefit for service included in payment" },
  { code: "PR-1", desc: "Deductible amount" },
  { code: "PR-2", desc: "Co-insurance amount" },
  { code: "PR-3", desc: "Co-pay amount" },
  { code: "OA-23", desc: "Payment adjusted - prior payer" },
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
  const [postings, setPostings] = useState<ERAPosting[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filterProvider, setFilterProvider] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState<CPTLine[]>([{ ...emptyLine }]);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: clientData }, { data: postingData }] = await Promise.all([
      supabase.from("clients").select("id, full_name"),
      supabase
        .from("era_eob_postings")
        .select("*")
        .eq("created_by", user.id)
        .order("payment_date", { ascending: false }),
    ]);

    setClients(clientData ?? []);
    setPostings(
      (postingData ?? []).map((p: any) => ({
        ...p,
        cpt_lines: Array.isArray(p.cpt_lines)
          ? p.cpt_lines
          : JSON.parse(p.cpt_lines || "[]"),
      }))
    );

    setLoading(false);
  }

  /* ================= LINE HELPERS ================= */

  function addLine() {
    setLines((p) => [...p, { ...emptyLine }]);
  }

  function updateLine(i: number, field: keyof CPTLine, value: any) {
    setLines((p) =>
      p.map((l, idx) => (idx === i ? { ...l, [field]: value } : l))
    );
  }

  function removeLine(i: number) {
    setLines((p) => p.filter((_, idx) => idx !== i));
  }

  function totals() {
    return {
      billed: lines.reduce((a, b) => a + b.billed, 0),
      allowed: lines.reduce((a, b) => a + b.allowed, 0),
      paid: lines.reduce((a, b) => a + b.paid, 0),
      adjustment: lines.reduce((a, b) => a + b.adjustment, 0),
      patient_resp: lines.reduce((a, b) => a + b.patient_resp, 0),
    };
  }

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
            lines
              .filter((l) => l.denial_reason)
              .map((l) => l.denial_reason)
              .join("; ") || null,
          cpt_lines: JSON.stringify(lines),
          status: hasDenials ? "partial_denial" : status,
          notes: form.notes || null,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (data) {
      setPostings((p) => [{ ...data, cpt_lines: lines }, ...p]);
    }

    setForm(emptyForm);
    setLines([{ ...emptyLine }]);
    setShowForm(false);
    setSaving(false);
  }

  /* ================= FILTERING ================= */

  const clientMap = new Map(clients.map((c) => [c.id, c.full_name]));

  let filtered = postings;
  if (filterProvider)
    filtered = filtered.filter(
      (p) => p.insurance_provider === filterProvider
    );
  if (filterStatus) filtered = filtered.filter((p) => p.status === filterStatus);

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
    if (status === "partial_denial")
      return "bg-orange-100 text-orange-700";
    if (status === "denied") return "bg-red-100 text-red-700";
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-600";
  }

  /* ================= UI ================= */

  return (
    <div className="space-y-6">
      <PageHeader title="ERA / EOB Posting">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Post ERA/EOB"}
        </Button>
      </PageHeader>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border rounded-xl text-center">
          <p className="text-2xl font-bold text-green-600">
            ${totalPaid.toFixed(0)}
          </p>
          <p className="text-xs text-gray-500">Paid</p>
        </div>
        <div className="p-4 bg-white border rounded-xl text-center">
          <p className="text-2xl font-bold text-blue-600">
            ${totalBilled.toFixed(0)}
          </p>
          <p className="text-xs text-gray-500">Billed</p>
        </div>
        <div className="p-4 bg-white border rounded-xl text-center">
          <p className="text-2xl font-bold text-purple-600">
            {collectionRate}%
          </p>
          <p className="text-xs text-gray-500">Collection</p>
        </div>
      </div>

      {/* CHART */}
      {chartData.length > 0 && (
        <Section title="Payments Trend">
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
    </div>
  );
}