"use client";

import { useState } from "react";
// @ts-ignore
import Papa from "papaparse";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  full_name: string;
  email: string;
  role: string;
};

export default function ImportUsersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const handleParse = () => {
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Row>) => {
        setRows(results.data as Row[]);
        console.log("Parsed CSV:", results.data);
      },
    });
  };

  const handleImport = async () => {
    if (!rows.length) return;

    for (const row of rows) {
      // 1. Invite user via Supabase Auth
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(
        row.email,
        {
          data: {
            full_name: row.full_name,
            role: row.role,
          },
        }
      );

      if (error) {
        console.error("Invite error:", error);
        continue;
      }

      const userId = data.user?.id;

      // 2. Insert into company_users
      await supabase.from("company_users").insert({
        user_id: userId,
        role: row.role,
        status: "pending_invite",
      });
    }

    alert("Users imported!");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Bulk User Import</h1>

      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button onClick={handleParse} disabled={!file}>
        Parse CSV
      </button>

      {rows.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Preview</h3>
          <pre>{JSON.stringify(rows, null, 2)}</pre>

          <button onClick={handleImport} style={{ marginTop: 20 }}>
            Import Users
          </button>
        </div>
      )}
    </div>
  );
}