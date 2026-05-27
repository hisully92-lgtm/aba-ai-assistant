"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };

const DAILY_TASKS = [
  {
    category: "Pre-Session",
    icon: "📋",
    tasks: [
      "Review client's BIP and behavior programs before session",
      "Review session notes from previous session",
      "Set up therapy materials and environment",
      "Confirm parent/caregiver is available if needed",
      "Check reinforcer availability and preferences",
      "Review any updates or changes from BCBA",
      "Clock in / check geofence",
    ],
  },
  {
    category: "During Session",
    icon: "🧠",
    tasks: [
      "Implement skill acquisition programs per BIP",
      "Implement behavior reduction strategies per BIP",
      "Collect data on all target behaviors",
      "Collect data on all skill programs",
      "Implement reinforcement procedures correctly",
      "Follow antecedent strategies from BIP",
      "Follow consequence strategies from BIP",
      "Prompt according to specified hierarchy",
      "Document any behaviors outside of targets",
      "Conduct ABC data for any escalations",
    ],
  },
  {
    category: "Behavior Management",
    icon: "⚠️",
    tasks: [
      "Follow crisis plan if behavior escalates",
      "Implement de-escalation strategies from BIP",
      "Maintain client and staff safety at all times",
      "Document any incidents using incident report form",
      "Contact BCBA if crisis procedure needed",
    ],
  },
  {
    category: "Post-Session",
    icon: "✅",
    tasks: [
      "Complete session note with objective data",
      "Graph behavior data",
      "Submit data collection forms",
      "Clock out",
      "Communicate any concerns to BCBA",
      "Update parent/caregiver on session",
      "Clean up therapy materials",
      "Check that all client items are returned",
    ],
  },
  {
    category: "Weekly",
    icon: "📅",
    tasks: [
      "Review supervision logs with BCBA",
      "Complete any competency assessments due",
      "Review data trends with BCBA",
      "Update training documentation",
      "Review BACB ethics code reminders",
    ],
  },
];

export default function RBTChecklistPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    const { data } = await supabase.from("clients").select("id, full_name");
    setClients(data ?? []);
  }

  function toggleItem(key: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function totalTasks() {
    return DAILY_TASKS.reduce((a, cat) => a + cat.tasks.length, 0);
  }

  function completedPct() {
    return Math.round((checkedItems.size / totalTasks()) * 100);
  }

  function resetChecklist() {
    setCheckedItems(new Set());
    setNotes({});
    setSaved(false);
  }

  const allTasksDone = checkedItems.size === totalTasks();
  const sessionTasks = DAILY_TASKS.filter((cat) => cat.category !== "Weekly");
  const weeklyTasks = DAILY_TASKS.filter((cat) => cat.category === "Weekly");

  return (
    <div className="space-y-6">
      <PageHeader title="RBT Daily Checklist">
        <Button variant="outline" onClick={resetChecklist}>🔄 Reset</Button>
      </PageHeader>

      {/* SESSION HEADER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
          <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">Select client...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Session Date</label>
          <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
      </div>

      {/* PROGRESS */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-700">Session Progress</p>
          <p className="text-sm font-bold text-blue-600">{checkedItems.size}/{totalTasks()} ({completedPct()}%)</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className={`h-3 rounded-full transition-all ${allTasksDone ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${completedPct()}%` }} />
        </div>
        {allTasksDone && (
          <p className="text-green-600 text-sm font-bold mt-2">✓ All tasks complete! Great session.</p>
        )}
      </div>

      {/* SESSION TASKS */}
      {sessionTasks.map((category) => {
        const catCompleted = category.tasks.filter((_, i) =>
          checkedItems.has(`${category.category}-${i}`)
        ).length;
        return (
          <Section key={category.category} title={`${category.icon} ${category.category} (${catCompleted}/${category.tasks.length})`}>
            <div className="space-y-2">
              {category.tasks.map((task, i) => {
                const key = `${category.category}-${i}`;
                const isChecked = checkedItems.has(key);
                return (
                  <div key={i} className={`flex items-start gap-3 border rounded-lg p-3 transition-all ${isChecked ? "border-green-200 bg-green-50" : "border-gray-100 bg-white"}`}>
                    <button onClick={() => toggleItem(key)}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${isChecked ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}>
                      {isChecked && "✓"}
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm ${isChecked ? "line-through text-gray-400" : "text-gray-700"}`}>{task}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        );
      })}

      {/* WEEKLY TASKS */}
      {weeklyTasks.map((category) => {
        const catCompleted = category.tasks.filter((_, i) =>
          checkedItems.has(`${category.category}-${i}`)
        ).length;
        return (
          <Section key={category.category} title={`${category.icon} ${category.category} (${catCompleted}/${category.tasks.length})`}>
            <div className="space-y-2">
              {category.tasks.map((task, i) => {
                const key = `${category.category}-${i}`;
                const isChecked = checkedItems.has(key);
                return (
                  <div key={i} className={`flex items-center gap-3 border rounded-lg p-3 transition-all ${isChecked ? "border-green-200 bg-green-50" : "border-gray-100 bg-white"}`}>
                    <button onClick={() => toggleItem(key)}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isChecked ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}>
                      {isChecked && "✓"}
                    </button>
                    <p className={`text-sm flex-1 ${isChecked ? "line-through text-gray-400" : "text-gray-700"}`}>{task}</p>
                  </div>
                );
              })}
            </div>
          </Section>
        );
      })}

      {/* QUICK LINKS */}
      <Section title="Quick Access">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Session Notes", href: "/dashboard", icon: "📋" },
            { label: "Data Collection", href: "/dashboard/data-collection", icon: "📊" },
            { label: "Incident Report", href: "/dashboard/incidents", icon: "⚠️" },
            { label: "BIP Plans", href: "/dashboard/bip", icon: "🧠" },
          ].map((link) => (
            <a key={link.label} href={link.href}
              className="flex flex-col items-center gap-2 border border-gray-100 rounded-xl p-4 bg-white hover:shadow-sm hover:border-blue-200 transition-all">
              <span className="text-2xl">{link.icon}</span>
              <span className="text-xs font-medium text-gray-700 text-center">{link.label}</span>
            </a>
          ))}
        </div>
      </Section>
    </div>
  );
}