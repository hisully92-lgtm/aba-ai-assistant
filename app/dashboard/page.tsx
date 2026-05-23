"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import BillingCard from "@/components/billing/BillingCard";

export default function DashboardHome() {
  const [stats, setStats] = useState({
    clients: 0,
    sessions: 0,
    behaviors: 0,
    programs: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [clients, sessions, behaviors, programs] = await Promise.all([
      supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("created_by", user.id),

      supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("created_by", user.id),

      supabase
        .from("behaviors")
        .select("*", { count: "exact", head: true })
        .eq("created_by", user.id),

      supabase
        .from("programs")
        .select("*", { count: "exact", head: true })
        .eq("created_by", user.id),
    ]);

    setStats({
      clients: clients.count || 0,
      sessions: sessions.count || 0,
      behaviors: behaviors.count || 0,
      programs: programs.count || 0,
    });
  }

  return (
    <div className="space-y-6">

      {/* BILLING SECTION (NEW) */}
      <BillingCard />

      {/* STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <div className="p-4 border rounded-xl bg-white shadow">
          <p className="text-gray-500">Clients</p>
          <p className="text-2xl font-bold">{stats.clients}</p>
        </div>

        <div className="p-4 border rounded-xl bg-white shadow">
          <p className="text-gray-500">Sessions</p>
          <p className="text-2xl font-bold">{stats.sessions}</p>
        </div>

        <div className="p-4 border rounded-xl bg-white shadow">
          <p className="text-gray-500">Behaviors</p>
          <p className="text-2xl font-bold">{stats.behaviors}</p>
        </div>

        <div className="p-4 border rounded-xl bg-white shadow">
          <p className="text-gray-500">Programs</p>
          <p className="text-2xl font-bold">{stats.programs}</p>
        </div>

      </div>
    </div>
  );
}