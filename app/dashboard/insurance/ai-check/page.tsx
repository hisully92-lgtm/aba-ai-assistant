"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string; diagnosis: string | null };
type InsuranceClaim = {
  id: string;
  client_id: string;
  cpt_code: string;
  units: number;
  amount: number;
  status: string;
};

type CheckResult = {
  cpt_code: string;
  issue: string | null;
  recommendation: string;
  severity: "ok" | "warning" | "error";
};

const CPT_RULES: Record<string, { maxUnitsPerDay: number; requiresDiagnosis: string[]; description: string }> = {
  "97153": { maxUnitsPerDay: 96, requiresDiagnosis: ["ASD", "Autism"], description: "ABA Treatment by Protocol" },
  "97154": { maxUnitsPerDay: 32, requiresDiagnosis: ["ASD", "Autism"], description: "Group ABA Treatment" },
  "97155": { maxUnitsPerDay: 16, requiresDiagnosis: ["ASD", "Autism"], description: "Protocol Modification" },
  "97156": { maxUnitsPerDay: 8, requiresDiagnosis: [], description: "Family Guidance" },
  "97157": { maxUnitsPerDay: 8, requiresDiagnosis: [], description: "Multiple Family Group" },
  "97158": { maxUnitsPerDay: 16, requiresDiagnosis: ["ASD", "Autism"], description: "Group Protocol Modification" },
};

export default function InsuranceAICheckPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [checking, setChecking] = useState(false);
  const [aiChecking, setAiChecking] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, []);

  async function init() {
    const [{ data: clientData }, { data: claimData }] = await Promise.all([
      supabase.from("clients").select("id, full_name, diagnosis"),
      supabase.from("insurance_claims").select("id, client_id, cpt_code, units, amount, status"),
    ]);
    setClients(clientData ?? []);
    setClaims(claimData ?? []);
    setLoading(false);
  }

  function runLocalCheck() {
    if (!selectedClientId) return;
    setChecking(true);
    setResults([]);
    setAiSummary(null);

    const client = clients.find((c) => c.id === selectedClientId);
    const clientClaims = claims.filter((c) => c.client_id === selectedClientId);

    const checkResults: CheckResult[] = [];

    if (clientClaims.length === 0) {
      checkResults.push({
        cpt_code: "General",
        issue: null,
        recommendation: "No claims found for this client.",
        severity: "ok",
      });
    }

    for (const claim of clientClaims) {
      const rule = CPT_RULES[claim.cpt_code];

      if (!rule) {
        checkResults.push({
          cpt_code: claim.cpt_code,
          issue: "Unknown CPT code",
          recommendation: "Verify this CPT code is valid for ABA services.",
          severity: "warning",
        });
        continue;
      }

      // Check units
      if (claim.units > rule.maxUnitsPerDay) {
        checkResults.push({
          cpt_code: claim.cpt_code,
          issue: `Units (${claim.units}) exceed daily maximum (${rule.maxUnitsPerDay})`,
          recommendation: `Reduce units to ${rule.maxUnitsPerDay} or split across multiple days.`,
          severity: "error",
        });
      } else {
        checkResults.push({
          cpt_code: claim.cpt_code,
          issue: null,
          recommendation: `Units (${claim.units}) within allowed range for ${rule.description}.`,
          severity: "ok",
        });
      }

      // Check diagnosis
      if (rule.requiresDiagnosis.length > 0 && client?.diagnosis) {
        const hasValidDiagnosis = rule.requiresDiagnosis.some((d) =>
          client.diagnosis?.toLowerCase().includes(d.toLowerCase())
        );
        if (!hasValidDiagnosis) {
          checkResults.push({
            cpt_code: claim.cpt_code,
            issue: `CPT ${claim.cpt_code} typically requires ASD diagnosis`,
            recommendation: "Verify client diagnosis supports this CPT code with your insurance provider.",
            severity: "warning",
          });
        }
      }

      // Check amount reasonableness
      const expectedRate = claim.amount / claim.units;
      if (expectedRate > 50) {
        checkResults.push({
          cpt_code: claim.cpt_code,
          issue: `Rate per unit ($${expectedRate.toFixed(2)}) may be high`,
          recommendation: "Verify rate is within contracted amounts with insurance provider.",
          severity: "warning",
        });
      }
    }

    setResults(checkResults);
    setChecking(false);
  }

  async function runAICheck() {
    if (!selectedClientId || claims.length === 0) return;
    setAiChecking(true);
    setAiSummary(null);

    const client = clients.find((c) => c.id === selectedClientId);
    const clientClaims = claims.filter((c) => c.client_id === selectedClientId);

    const claimsText = clientClaims.map((c) =>
      `CPT: ${c.cpt_code}, Units: ${c.units}, Amount: $${c.amount}, Status: ${c.status}`
    ).join("\n");

    const prompt = `You are an ABA insurance billing compliance expert. Review these insurance claims for compliance issues:

Client: ${client?.full_name ?? "Unknown"}
Diagnosis: ${client?.diagnosis ?? "Not specified"}

Claims:
${claimsText}

Common ABA CPT codes:
- 97153: ABA Treatment by Protocol (max 96 units/day)
- 97154: Group ABA (max 32 units/day)
- 97155: Protocol Modification (max 16 units/day)
- 97156: Family Guidance (max 8 units/day)
- 97158: Group Protocol Modification (max 16 units/day)

Provide a brief compliance review covering:
1. Any billing concerns or red flags
2. Documentation requirements
3. Specific recommendations for each CPT code
4. Overall compliance status

Be concise and practical.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text ?? "Unable to generate review.";
      setAiSummary(text);
    } catch {
      setAiSummary("AI check failed. Please try again.");
    } finally {
      setAiChecking(false);
    }
  }

  function severityColor(severity: string) {
    if (severity === "error") return "bg-red-50 border-red-200";
    if (severity === "warning") return "bg-yellow-50 border-yellow-200";
    return "bg-green-50 border-green-200";
  }

  function severityIcon(severity: string) {
    if (severity === "error") return "❌";
    if (severity === "warning") return "⚠️";
    return "✅";
  }

  const errorCount = results.filter((r) => r.severity === "error").length;
  const warningCount = results.filter((r) => r.severity === "warning").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Insurance AI Compliance Check">
        <p className="text-gray-500 text-sm">Verify claims against ABA billing rules.</p>
      </PageHeader>

      <Section title="Select Client">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
            <select
              value={selectedClientId}
              onChange={(e) => { setSelectedClientId(e.target.value); setResults([]); setAiSummary(null); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-64"
            >
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <Button onClick={runLocalCheck} loading={checking} disabled={!selectedClientId}>
            Run Compliance Check
          </Button>
          <Button variant="outline" onClick={runAICheck} loading={aiChecking} disabled={!selectedClientId}>
            🤖 AI Deep Review
          </Button>
        </div>
      </Section>

      {/* RESULTS SUMMARY */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{results.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total Checks</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{errorCount}</p>
            <p className="text-xs text-gray-500 mt-1">Errors</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{warningCount}</p>
            <p className="text-xs text-gray-500 mt-1">Warnings</p>
          </div>
        </div>
      )}

      {/* CHECK RESULTS */}
      {results.length > 0 && (
        <Section title="Compliance Results">
          <div className="space-y-2">
            {results.map((result, i) => (
              <div key={i} className={`border rounded-lg p-4 ${severityColor(result.severity)}`}>
                <div className="flex items-start gap-3">
                  <span className="text-lg">{severityIcon(result.severity)}</span>
                  <div>
                    <p className="font-medium text-gray-800">CPT {result.cpt_code}</p>
                    {result.issue && <p className="text-sm text-red-700 mt-0.5">{result.issue}</p>}
                    <p className="text-sm text-gray-600 mt-1">{result.recommendation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* AI SUMMARY */}
      {aiSummary && (
        <Section title="🤖 AI Compliance Review">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
            {aiSummary}
          </div>
        </Section>
      )}
    </div>
  );
}