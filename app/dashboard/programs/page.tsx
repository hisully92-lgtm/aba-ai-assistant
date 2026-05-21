"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Program = {
  id: string;
  staff_member: string;
  program_name: string;
  goal: string;
  targets: string;
  prompt_level: string;
  mastery_criteria: string;
  trial_data: string;
  notes: string;
};

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);

  // FORM STATE
  const [staffMember, setStaffMember] = useState("");
  const [programName, setProgramName] = useState("");
  const [goal, setGoal] = useState("");
  const [targets, setTargets] = useState("");
  const [promptLevel, setPromptLevel] = useState("");
  const [masteryCriteria, setMasteryCriteria] = useState("");
  const [trialData, setTrialData] = useState("");
  const [notes, setNotes] = useState("");

  // -------------------------
  // LOAD PROGRAMS
  // -------------------------
  useEffect(() => {
    fetchPrograms();
  }, []);

  async function fetchPrograms() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch programs error:", error.message);
      return;
    }

    setPrograms(data ?? []);
  }

  // -------------------------
  // SAVE PROGRAM
  // -------------------------
  async function handleSaveProgram() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("programs")
      .insert([
        {
          staff_member: staffMember,
          program_name: programName,
          goal,
          targets,
          prompt_level: promptLevel,
          mastery_criteria: masteryCriteria,
          trial_data: trialData,
          notes,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Save program error:", error.message);
      return;
    }

    if (data) {
      setPrograms((prev) => [data, ...prev]);
    }

    // reset
    setStaffMember("");
    setProgramName("");
    setGoal("");
    setTargets("");
    setPromptLevel("");
    setMasteryCriteria("");
    setTrialData("");
    setNotes("");
  }

  // -------------------------
  // UI (UNCHANGED DESIGN)
  // -------------------------
  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">
        Skill Programs
      </h2>

      <p className="text-gray-600 mb-6">
        Create teaching programs with targets, prompting, mastery criteria, trial data, and notes.
      </p>

      <div className="flex flex-col gap-4">

        <input value={staffMember} onChange={(e) => setStaffMember(e.target.value)} placeholder="Staff Member" className="border rounded-lg p-3" />
        <input value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="Program Name" className="border rounded-lg p-3" />

        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className="border rounded-lg p-3 min-h-[100px]" />
        <textarea value={targets} onChange={(e) => setTargets(e.target.value)} placeholder="Targets" className="border rounded-lg p-3 min-h-[100px]" />

        <input value={promptLevel} onChange={(e) => setPromptLevel(e.target.value)} placeholder="Prompt Level" className="border rounded-lg p-3" />
        <input value={masteryCriteria} onChange={(e) => setMasteryCriteria(e.target.value)} placeholder="Mastery Criteria" className="border rounded-lg p-3" />

        <textarea value={trialData} onChange={(e) => setTrialData(e.target.value)} placeholder="Trial Data" className="border rounded-lg p-3 min-h-[120px]" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="border rounded-lg p-3 min-h-[120px]" />

        <div className="border rounded-xl p-4 bg-gray-50">
          <h3 className="font-bold text-lg mb-2">Graph</h3>
          <p className="text-gray-600">
            Graphing will be added later. For now, enter trial data above.
          </p>
        </div>

        <button
          onClick={handleSaveProgram}
          className="bg-black text-white rounded-lg p-3 font-medium"
        >
          Save Skill Program
        </button>

      </div>
    </div>
  );
}