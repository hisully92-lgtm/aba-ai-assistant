"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Billing = {
  total_amount: number;
  status: string;
};

type Claim = {
  amount: number;
  status: string;
};

export default function RevenueDashboard() {
  const [billing, setBilling] = useState<Billing[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);

  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    const { data: billingData } = await supabase
      .from("billing_sessions")
      .select("total_amount, status");

    const { data: claimData } = await supabase
      .from("insurance_claims")
      .select("amount, status");

    setBilling(billingData || []);
    setClaims(claimData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // BILLING CALCS
  const billedTotal = billing.reduce((sum, b) => sum + b.total_amount, 0);

  const paidClaims = claims
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.amount, 0);

  const pendingClaims = claims
    .filter((c) => c.status === "submitted")
    .reduce((sum, c) => sum + c.amount, 0);

  const deniedClaims = claims
    .filter((c) => c.status === "denied")
    .reduce((sum, c) => sum + c.amount, 0);

  if (loading) return <p style={{ padding: 20 }}>Loading analytics...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Revenue Analytics Dashboard</h1>

      {/* KPI CARDS */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
        <div style={{ padding: 15, border: "1px solid #ddd" }}>
          <h3>Total Billed</h3>
          <p>${billedTotal.toFixed(2)}</p>
        </div>

        <div style={{ padding: 15, border: "1px solid #ddd" }}>
          <h3>Paid Insurance</h3>
          <p>${paidClaims.toFixed(2)}</p>
        </div>

        <div style={{ padding: 15, border: "1px solid #ddd" }}>
          <h3>Pending Claims</h3>
          <p>${pendingClaims.toFixed(2)}</p>
        </div>

        <div style={{ padding: 15, border: "1px solid #ddd" }}>
          <h3>Denied Claims</h3>
          <p>${deniedClaims.toFixed(2)}</p>
        </div>
      </div>

      {/* INSIGHT SECTION */}
      <div style={{ marginTop: 30 }}>
        <h2>Clinical Revenue Insights</h2>

        <ul>
          <li>
            Insurance collection rate:{" "}
            {((paidClaims / (billedTotal || 1)) * 100).toFixed(1)}%
          </li>

          <li>
            Outstanding revenue: ${(pendingClaims + deniedClaims).toFixed(2)}
          </li>

          <li>
            Total clinical output: ${billedTotal.toFixed(2)}
          </li>
        </ul>
      </div>
    </div>
  );
}