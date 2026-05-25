"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

type Program = {
  id: string;
  program_name: string;
  goal: string;
  prompt_level: string;
  mastery_criteria: string;
  trial_data: string;
  created_at: string;
};

export default function ProgramProgressPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const { data } = await supabase
        .from("programs")
        .select("id, program_name, goal, prompt_level, mastery_criteria, trial_data, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      setPrograms(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Program Progress">
        <p className="text-gray-500 text-sm">Track skill acquisition across all programs.</p>
      </PageHeader>

      <Section title={`Programs — ${programs.length} active`}>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && programs.length === 0 && (
          <p className="text-gray-400 text-sm">No programs recorded yet.</p>
        )}
        <div className="space-y-3">
          {programs.map((p) => (
            <div key={p.id} className="border border-gray-100 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-gray-800">{p.program_name}</p>
                <p className="text-xs text-gray-400">
                  {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm text-gray-600">
                {p.goal && <p><span className="font-medium">Goal:</span> {p.goal}</p>}
                {p.prompt_level && <p><span className="font-medium">Prompt Level:</span> {p.prompt_level}</p>}
                {p.mastery_criteria && <p><span className="font-medium">Mastery:</span> {p.mastery_criteria}</p>}
                {p.trial_data && <p><span className="font-medium">Trial Data:</span> {p.trial_data}</p>}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}