"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import jsPDF from "jspdf";
import { getWeeklySummary } from "@/lib/services/weeklySummaryService";

type Client = {
  id: string;
  full_name: string;
};

type SessionNote = {
  note: string;
  session_date: string;
};

type BehaviorLog = {
  behavior_type: string;
  frequency: number;
  duration_minutes: number;
  recorded_at: string;
};

export default function ReportsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [behaviors, setBehaviors] = useState<BehaviorLog[]>([]);

  // NEW: weekly summary state
  const [summary, setSummary] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  async function loadClients() {
    const { data } = await supabase.from("clients").select("*");
    setClients(data || []);
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function loadReportData(clientId: string) {
    setSelectedClient(clientId);

    const { data: notesData } = await supabase
      .from("session_notes")
      .select("*")
      .eq("client_id", clientId);

    const { data: behaviorData } = await supabase
      .from("behavior_logs")
      .select("*")
      .eq("client_id", clientId);

    setNotes(notesData || []);
    setBehaviors(behaviorData || []);

    // NEW: load AI summary when client is selected
    setLoadingSummary(true);
    const result = await getWeeklySummary();
    setSummary(result);
    setLoadingSummary(false);
  }

  function exportPDF() {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("ABA Clinical Report", 20, 20);

    doc.setFontSize(12);
    doc.text(`Client ID: ${selectedClient}`, 20, 30);

    let y = 40;

    doc.text("Session Notes:", 20, y);
    y += 10;

    notes.forEach((n) => {
      doc.text(`- ${n.note}`, 20, y);
      y += 8;
    });

    y += 10;
    doc.text("Behavior Summary:", 20, y);
    y += 10;

    behaviors.forEach((b) => {
      doc.text(
        `- ${b.behavior_type}: ${b.frequency} times (${b.duration_minutes} min)`,
        20,
        y
      );
      y += 8;
    });

    doc.save("clinical-report.pdf");
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Clinical Reporting System</h1>

      {/* CLIENT SELECT */}
      <div style={{ marginBottom: 20 }}>
        <h2>Select Client</h2>

        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => loadReportData(c.id)}
            style={{
              marginRight: 10,
              padding: 8,
              border: "1px solid #ccc",
            }}
          >
            {c.full_name}
          </button>
        ))}
      </div>

      {/* REPORT PREVIEW */}
      {selectedClient && (
        <div style={{ marginTop: 20 }}>
          <h2>Report Preview</h2>

          {/* SESSION NOTES */}
          <h3>Session Notes</h3>
          <ul>
            {notes.map((n, i) => (
              <li key={i}>{n.note}</li>
            ))}
          </ul>

          {/* BEHAVIOR LOGS */}
          <h3>Behavior Logs</h3>
          <ul>
            {behaviors.map((b, i) => (
              <li key={i}>
                {b.behavior_type} — {b.frequency}x — {b.duration_minutes} min
              </li>
            ))}
          </ul>

          {/* NEW: WEEKLY SUMMARY */}
          <h3 style={{ marginTop: 20 }}>AI Weekly Summary</h3>

          {loadingSummary ? (
            <p>Generating summary...</p>
          ) : (
            <pre style={{ whiteSpace: "pre-wrap", padding: 10, border: "1px solid #ddd" }}>
              {summary}
            </pre>
          )}

          {/* EXPORT */}
          <button
            onClick={exportPDF}
            style={{
              marginTop: 20,
              padding: 10,
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 6,
            }}
          >
            Export PDF Report
          </button>
        </div>
      )}
    </div>
  );
}