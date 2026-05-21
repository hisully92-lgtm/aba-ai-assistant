"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";

type Profile = {
  id: string;
  full_name: string;
  role: string;
};

type Client = {
  id: string;
  full_name: string;
};

type Assignment = {
  id: string;
  client_id: string;
  rbt_id: string;
};

export default function SupervisorPage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [rbts, setRbts] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [selectedClient, setSelectedClient] = useState("");
  const [selectedRbt, setSelectedRbt] = useState("");

  // 🔐 ROLE PROTECTION
  useEffect(() => {
    requireRole(["admin", "supervisor"]);
  }, []);

  // 📦 LOAD DATA
  async function loadData() {
    const [{ data: clientData }, { data: rbtData }, { data: assignmentData }] =
      await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("profiles").select("*").eq("role", "rbt"),
        supabase.from("assignments").select("*"),
      ]);

    setClients(clientData || []);
    setRbts(rbtData || []);
    setAssignments(assignmentData || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  // ➕ CREATE ASSIGNMENT
  async function createAssignment() {
    if (!selectedClient || !selectedRbt) {
      alert("Select client and RBT");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("assignments").insert({
      client_id: selectedClient,
      rbt_id: selectedRbt,
      supervisor_id: user?.id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setSelectedClient("");
    setSelectedRbt("");
    loadData();
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Supervisor Dashboard</h1>

      {/* ASSIGNMENT TOOL */}
      <div
        style={{
          padding: 15,
          border: "1px solid #ddd",
          marginBottom: 20,
        }}
      >
        <h2>Assign RBT to Client</h2>

        {/* CLIENT SELECT */}
        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          style={{ marginRight: 10 }}
        >
          <option value="">Select Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>

        {/* RBT SELECT */}
        <select
          value={selectedRbt}
          onChange={(e) => setSelectedRbt(e.target.value)}
          style={{ marginRight: 10 }}
        >
          <option value="">Select RBT</option>
          {rbts.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>

        <button onClick={createAssignment}>
          Create Assignment
        </button>
      </div>

      {/* CURRENT ASSIGNMENTS */}
      <div>
        <h2>Current Assignments</h2>

        <table border={1} cellPadding={10} style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Client ID</th>
              <th>RBT ID</th>
            </tr>
          </thead>

          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.client_id}</td>
                <td>{a.rbt_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}