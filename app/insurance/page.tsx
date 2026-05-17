"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Claim = {
  id: string;
  cpt_code: string;
  units: number;
  amount: number;
  status: string;
};

type Provider = {
  id: string;
  name: string;
};

export default function InsurancePage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");

  // LOAD PROVIDERS
  async function loadProviders() {
    const { data } = await supabase.from("insurance_providers").select("*");
    setProviders(data || []);
  }

  // LOAD CLAIMS
  async function loadClaims(providerId: string) {
    setSelectedProvider(providerId);

    const { data } = await supabase
      .from("insurance_claims")
      .select("*")
      .eq("provider_id", providerId);

    setClaims(data || []);
  }

  useEffect(() => {
    loadProviders();
  }, []);

  // UPDATE CLAIM STATUS
  async function updateStatus(id: string, status: string) {
    await supabase
      .from("insurance_claims")
      .update({ status })
      .eq("id", id);

    if (selectedProvider) loadClaims(selectedProvider);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Insurance Claims System</h1>

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

      {/* CLAIMS TABLE */}
      <h2 style={{ marginTop: 20 }}>Claims</h2>

      <table border={1} cellPadding={10} style={{ width: "100%" }}>
        <thead>
          <tr>
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
              <td>{c.cpt_code}</td>
              <td>{c.units}</td>
              <td>${c.amount}</td>
              <td>{c.status}</td>
              <td>
                <select
                  value={c.status}
                  onChange={(e) => updateStatus(c.id, e.target.value)}
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