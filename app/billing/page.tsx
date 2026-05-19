"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Client = {
  id: string;
  full_name: string;
};

type BillingRecord = {
  id: string;
  client_id: string;
  session_id: string;
  duration_minutes: number;
  billable_units: number;
  rate_per_unit: number;
  total_amount: number;
  status: string;
};

export default function BillingPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");

  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [rate, setRate] = useState(25);

  // =========================================================
  // LOAD CLIENTS
  // =========================================================
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("clients").select("*");
      setClients(data || []);
    };

    load();
  }, []);

  // =========================================================
  // LOAD BILLING RECORDS
  // =========================================================
  async function loadBilling(clientId: string) {
    setSelectedClient(clientId);

    const { data } = await supabase
      .from("billing_sessions")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    setRecords(data || []);
  }

  // =========================================================
  // AUTO CREATE BILLING FROM COMPLETED SESSION
  // =========================================================
  async function syncSessionToBilling(session: any) {
    if (session.status !== "completed") return;

    const start = new Date(session.start_time);
    const end = new Date(session.end_time);

    const durationMinutes =
      (end.getTime() - start.getTime()) / 60000;

    // ABA BILLING RULE: 15-min units
    const units = Math.ceil(durationMinutes / 15);
    const total = units * rate;

    await supabase.from("billing_sessions").insert({
      client_id: session.client_id,
      session_id: session.id,
      duration_minutes: durationMinutes,
      billable_units: units,
      rate_per_unit: rate,
      total_amount: total,
      status: "draft",
    });
  }

  // =========================================================
  // LOAD + AUTO SYNC FROM SESSIONS
  // =========================================================
  useEffect(() => {
    const channel = supabase
      .channel("billing-sync")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
        },
        async (payload) => {
          const session = payload.new as any;

          // only generate billing when session completes
          if (session.status === "completed") {
            await syncSessionToBilling(session);

            if (session.client_id === selectedClient) {
              loadBilling(session.client_id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClient, rate]);

  // =========================================================
  // MANUAL BILLING CREATE (OPTIONAL OVERRIDE)
  // =========================================================
  async function createManualBilling(session: any) {
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);

    const duration = (end.getTime() - start.getTime()) / 60000;
    const units = Math.ceil(duration / 15);
    const total = units * rate;

    await supabase.from("billing_sessions").insert({
      client_id: session.client_id,
      session_id: session.id,
      duration_minutes: duration,
      billable_units: units,
      rate_per_unit: rate,
      total_amount: total,
      status: "draft",
    });

    loadBilling(session.client_id);
  }

  // =========================================================
  // UI
  // =========================================================
  return (
    <div style={{ padding: 20 }}>
      <h1>ABA Billing System</h1>

      {/* CLIENT SELECT */}
      <div style={{ marginBottom: 20 }}>
        <h2>Clients</h2>

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

      {/* RATE CONTROL */}
      <div style={{ marginBottom: 20 }}>
        <label>Rate per unit: </label>
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
        />
      </div>

      {/* BILLING TABLE */}
      <h2>Billing Records</h2>

      <table border={1} cellPadding={10} width="100%">
        <thead>
          <tr>
            <th>Minutes</th>
            <th>Units</th>
            <th>Rate</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>{r.duration_minutes}</td>
              <td>{r.billable_units}</td>
              <td>${r.rate_per_unit}</td>
              <td>${r.total_amount}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}