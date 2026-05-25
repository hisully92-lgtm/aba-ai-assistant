"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

type Behavior = {
  id: string;
  behavior_name: string;
  antecedent: string;
  behavior: string;
  consequence: string;
  frequency: string;
  intensity: string;
  created_at: string;
};

export default function BehaviorLogPage() {
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const { data } = await supabase
        .from("behaviors")
        .select("id, behavior_name, antecedent, behavior, consequence, frequency, intensity, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      setBehaviors(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Behavior Log">
        <p className="text-gray-500 text-sm">All recorded behavioral observations.</p>
      </PageHeader>

      <Section title={`Log — ${behaviors.length} records`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && behaviors.length === 0 && (
          <p className="text-gray-400 text-sm">No behaviors recorded yet.</p>
        )}
        <div className="space-y-3">
          {behaviors.map((b) => (
            <div key={b.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-gray-800">{b.behavior_name}</p>
                <p className="text-xs text-gray-400">
                  {new Date(b.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-sm text-gray-600">
                {b.antecedent && <p><span className="font-medium">Antecedent:</span> {b.antecedent}</p>}
                {b.behavior && <p><span className="font-medium">Behavior:</span> {b.behavior}</p>}
                {b.consequence && <p><span className="font-medium">Consequence:</span> {b.consequence}</p>}
                {b.frequency && <p><span className="font-medium">Frequency:</span> {b.frequency}</p>}
                {b.intensity && <p><span className="font-medium">Intensity:</span> {b.intensity}</p>}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
