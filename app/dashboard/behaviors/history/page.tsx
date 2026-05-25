"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

type Behavior = {
  id: string;
  behavior_name: string;
  intervention_used: string;
  replacement_behavior: string;
  function_hypothesis: string;
  created_at: string;
};

export default function BehaviorHistoryPage() {
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const { data } = await supabase
        .from("behaviors")
        .select("id, behavior_name, intervention_used, replacement_behavior, function_hypothesis, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      setBehaviors(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Intervention History">
        <p className="text-gray-500 text-sm">Historical record of interventions and outcomes.</p>
      </PageHeader>

      <Section title={`History — ${behaviors.length} records`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && behaviors.length === 0 && (
          <p className="text-gray-400 text-sm">No intervention history yet.</p>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm text-gray-600">
                {b.intervention_used && <p><span className="font-medium">Intervention:</span> {b.intervention_used}</p>}
                {b.replacement_behavior && <p><span className="font-medium">Replacement:</span> {b.replacement_behavior}</p>}
                {b.function_hypothesis && <p><span className="font-medium">Function:</span> {b.function_hypothesis}</p>}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}