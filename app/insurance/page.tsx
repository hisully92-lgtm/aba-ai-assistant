"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Provider = {
  id: string;
  name: string;
};

type Claim = {
  id: string;
  client_id: string;
  billing_session_id: string;
  cpt_code: string;
  units: number;
  amount: number;
  status: string;

  // 👇 joined table (THIS FIXES YOUR ERROR)
  clients?: {
    full_name: string;
  };
};

export default function InsurancePage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");

  const [loading, setLoading] = useState(false);

  // =========================================================
  // LOAD PROVIDERS
  // =========================================================
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("insurance_providers")
        .select("*");

      setProviders(data || []);
    };

    load();
  }, []);

  // =========================================================
  // LOAD CLAIMS
  // =========================================================
  async function loadClaims(providerId: string) {
    setSelectedProvider(providerId);
    setLoading(true);

    const { data } = await supabase
      .from("insurance_claims")
      .select(`
        *,
        clients(full_name),
        billing_sessions(id, duration_minutes, billable_units)
      `)
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });

    setClaims(data || []);
    setLoading(false);
  }

  // =========================================================
  // REAL-TIME UPDATES (CLAIMS)
  // =========================================================
  useEffect(() => {
    const channel = supabase
      .channel("insurance-claims")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "insurance_claims",
        },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          setClaims((prev: any[]) => {
            switch (payload.eventType) {
              case "INSERT":
                return [...prev, newRow];

              case "UPDATE":
                return prev.map((c) =>
                  c.id === newRow.id ? newRow : c
                );

              case "DELETE":
                return prev.filter((c) => c.id !== oldRow.id);

              default:
                return prev;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // =========================================================
  // UPDATE CLAIM STATUS
  // =========================================================
  async function updateStatus(id: string, status: string) {
    await supabase
      .from("insurance_claims")
      .update({ status })
      .eq("id", id);

    if (selectedProvider) {
      loadClaims(selectedProvider);
    }
  }

  // =========================================================
  // AUTO-GENERATE CLAIM FROM BILLING
  // =========================================================
  async function generateClaimsFromBilling() {
    if (!selectedProvider) return;

    const { data: billing } = await supabase
      .from("billing_sessions")
      .select("*")
      .eq("status", "draft");

    if (!billing?.length) return;

    const claimsToInsert = billing.map((b: any) => ({
      provider_id: selectedProvider,
      client_id: b.client_id,
      billing_session_id: b.id,

      // ABA default CPT assumption (can be expanded later)
      cpt_code: "97153",

      units: b.billable_units,
      amount: b.total_amount,
      status: "draft",
    }));

    await supabase.from("insurance_claims").insert(claimsToInsert);

    loadClaims(selectedProvider);
  }

  // =========================================================
  // UI
  // =========================================================
  return (
    <div style={{ padding: 20 }}>
      <h1>ABA Insurance Claims Engine</h1>

      {/* PROVIDERS */}
      <h2>Insurance Providers</h2>

      {providers.map((p) => (
        <button
          key={p.id}
          onClick={() => loadClaims(p.id)}
          style={{ marginRight: 10 }}
        >
          {p.name}
        </button>
      ))}

      {/* ACTIONS */}
      {selectedProvider && (
        <div style={{ marginTop: 15 }}>
          <button onClick={generateClaimsFromBilling}>
            + Generate Claims from Billing
          </button>
        </div>
      )}

      {/* STATUS */}
      {loading && <p>Loading claims...</p>}

      {/* CLAIMS TABLE */}
      <h2 style={{ marginTop: 20 }}>Claims</h2>

      <table border={1} cellPadding={10} width="100%">
        <thead>
          <tr>
            <th>Client</th>
            <th>CPT</th>
            <th>Units</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Update</th>
          </tr>
        </thead>

        <tbody>
          {claims.map((c) => (
            <tr key={c.id}>
              <td>{c.clients?.full_name}</td>
              <td>{c.cpt_code}</td>
              <td>{c.units}</td>
              <td>${c.amount}</td>

              <td>{c.status}</td>

              <td>
                <select
                  value={c.status}
                  onChange={(e) =>
                    updateStatus(c.id, e.target.value)
                  }
                >
                  <option value="draft">draft</option>
                  <option value="submitted">submitted</option>
                  <option value="approved">approved</option>
                  <option value="denied">denied</option>
                  <option value="paid">paid</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}