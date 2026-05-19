"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Authorizations({ clientId }: any) {
  const [auths, setAuths] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (!clientId) return;

      const { data, error } = await supabase
        .from("authorizations")
        .select("*")
        .eq("client_id", clientId)
        .eq("status", "active")
        .gte("end_date", new Date().toISOString())
        .lte("start_date", new Date().toISOString());

      if (!error) setAuths(data || []);
    };

    load();
  }, [clientId]);

  return (
    <div>
      <h2>Active Authorizations</h2>

      {auths.length === 0 && <p>No active authorizations</p>}

      {auths.map((a: any) => (
        <div key={a.id}>
          {a.cpt_code} — {a.total_units} units
        </div>
      ))}
    </div>
  );
}