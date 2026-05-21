"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Client = {
  id: string;
  full_name: string;
};

type Billing = {
  id: string;
  duration_minutes: number;
  billable_units: number;
  total_amount: number;
  status: string;
};

export default function BillingPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");

  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(25);

  const [records, setRecords] = useState<Billing[]>([]);

  // LOAD CLIENTS
  async function loadClients() {
    const { data } = await supabase.from("clients").select("*");
    setClients(data || []);
  }

  // LOAD BILLING RECORDS
  async function loadBilling(clientId: string) {
    setSelectedClient(clientId);

    const { data } = await supabase
      .from("billing_sessions")
      .select("*")
      .eq("client_id", clientId);

    setRecords(data || []);
  }

  useEffect(() => {
    loadClients();
  }, []);

  // CREATE BILLING SESSION
  async function createBilling() {
    if (!selectedClient || duration <= 0) return;

    const user = await supabase.auth.getUser();

    const units = duration / 15;
    const total = units * rate;

    const { error } = await supabase.from("billing_sessions").insert({
      client_id: selectedClient,
      rbt_id: user.data.user?.id,
      duration_minutes: duration,
      billable_units: units,
      rate_per_unit: rate,
      total_amount: total,
      status: "draft",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setDuration(0);
    loadBilling(selectedClient);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Billing System</h1>

      {/* CLIENT SELECT */}
      <div style={{ marginBottom: 20 }}>
        <h2>Select Client</h2>

        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => loadBilling(c.id)}
            style={{ marginRight: 10 }}
          >
            {c.full_name}
          </button>
        ))}
      </div>

      {/* CREATE BILLING ENTRY */}
      {selectedClient && (
        <div style={{ marginBottom: 20 }}>
          <h2>Create Billing Session</h2>

          <input
            type="number"
            placeholder="Duration (minutes)"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />

          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />

          <button onClick={createBilling}>Create Billing Record</button>
        </div>
      )}

      {/* BILLING TABLE */}
      <h2>Billing Records</h2>

      <table border={1} cellPadding={10} style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Duration</th>
            <th>Units</th>
            <th>Total ($)</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>{r.duration_minutes}</td>
              <td>{r.billable_units}</td>
              <td>${r.total_amount}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}