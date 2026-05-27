"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ---------------------------------- TYPES --------------------------------- */

type Client = {
  id: string;
  full_name: string;
};

type SessionDataPoint = {
  date: string;
  prompt_level: string;
  prompt_index: number;
  correct: number;
  total: number;
};

type PromptEntry = {
  id: string;
  client_id: string;
  program_name: string;
  target?: string;
  current_prompt_level: string;
  previous_prompt_level?: string;
  prompt_hierarchy: string[];
  session_data: SessionDataPoint[];
  goal_independent: boolean;
  fading_strategy: string;
  fading_direction?: string;
  session_date: string;
  notes: string | null;
  created_at: string;
};

/* -------------------------------- CONSTANTS ------------------------------- */

const INPUT_CLASS =
  "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

const PROMPT_LEVELS = [
  "Full Physical (FP)",
  "Partial Physical (PP)",
  "Model (M)",
  "Gesture (G)",
  "Positional (POS)",
  "Vocal/Verbal (V)",
  "Independent (I)",
];

const PROMPT_COLORS = [
  "bg-red-100 text-red-700",
  "bg-orange-100 text-orange-700",
  "bg-yellow-100 text-yellow-700",
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
  "bg-green-100 text-green-700",
];

const FADING_STRATEGIES = [
  {
    value: "most_to_least",
    label: "Most-to-Least (MTL)",
    desc: "Start with most intrusive prompts and fade toward independence.",
  },
  {
    value: "least_to_most",
    label: "Least-to-Most (LTM)",
    desc: "Start with least intrusive prompts and increase as needed.",
  },
  {
    value: "graduated_guidance",
    label: "Graduated Guidance",
    desc: "Fade physical guidance based on learner response.",
  },
  {
    value: "time_delay",
    label: "Time Delay",
    desc: "Insert delay between SD and prompt delivery.",
  },
];

/* -------------------------------- HELPERS -------------------------------- */

const getPromptColor = (level: string) => {
  const index = PROMPT_LEVELS.indexOf(level);
  return PROMPT_COLORS[index] ?? "bg-gray-100 text-gray-600";
};

const getDirectionData = (direction?: string) => {
  switch (direction) {
    case "fading":
      return {
        label: "↑ Fading Toward Independence",
        color: "bg-green-100 text-green-700",
      };

    case "increasing":
      return {
        label: "↓ Increasing Prompts",
        color: "bg-red-100 text-red-700",
      };

    default:
      return {
        label: "→ Maintaining",
        color: "bg-gray-100 text-gray-600",
      };
  }
};

const calculateAccuracy = (correct: number, total: number) => {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
};

/* ------------------------------ REUSABLE UI ------------------------------- */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium text-gray-700 mb-1 block">
      {children}
    </label>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_CLASS}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function MetricChart({
  title,
  data,
  dataKey,
  color,
  formatter,
  domain,
}: {
  title: string;
  data: any[];
  dataKey: string;
  color: string;
  formatter?: (value: any) => string;
  domain?: number[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-2">
        {title}
      </p>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f0f0f0"
          />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 9 }}
          />

          <YAxis
            domain={domain}
            tick={{ fontSize: 9 }}
            tickFormatter={formatter}
          />

          <Tooltip />

          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------- COMPONENT ------------------------------- */

export default function PromptFadingPage() {
  const [entries, setEntries] = useState<PromptEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data: clients }, { data: entries }] =
      await Promise.all([
        supabase
          .from("clients")
          .select("id, full_name")
          .eq("created_by", user.id),

        supabase
          .from("prompt_fading")
          .select("*")
          .eq("created_by", user.id),
      ]);

    setClients(clients ?? []);
    setEntries(entries ?? []);
    setLoading(false);
  }

  const clientMap = useMemo(
    () =>
      new Map(
        clients.map((client) => [
          client.id,
          client.full_name,
        ])
      ),
    [clients]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Prompt Fading">
        <Button>+ Log Prompt Session</Button>
      </PageHeader>

      <Section title="Prompt Hierarchy">
        <div className="flex flex-wrap gap-2">
          {PROMPT_LEVELS.map((level) => (
            <span
              key={level}
              className={`text-xs px-3 py-1 rounded-full font-medium ${getPromptColor(
                level
              )}`}
            >
              {level}
            </span>
          ))}
        </div>
      </Section>

      {entries.map((entry) => {
        const direction = getDirectionData(
          entry.fading_direction
        );

        const chartData = entry.session_data.map(
          (session) => ({
            date: session.date,
            accuracy: calculateAccuracy(
              session.correct,
              session.total
            ),
            prompt_index: session.prompt_index,
          })
        );

        return (
          <div
            key={entry.id}
            className="border rounded-xl bg-white p-4"
          >
            <div className="flex flex-wrap gap-2">
              <span
                className={`text-xs px-2 py-1 rounded-full ${getPromptColor(
                  entry.current_prompt_level
                )}`}
              >
                {entry.current_prompt_level}
              </span>

              <span
                className={`text-xs px-2 py-1 rounded-full ${direction.color}`}
              >
                {direction.label}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricChart
                title="Accuracy Over Time"
                data={chartData}
                dataKey="accuracy"
                color="#2563eb"
                domain={[0, 100]}
                formatter={(v) => `${v}%`}
              />

              <MetricChart
                title="Prompt Trend"
                data={chartData}
                dataKey="prompt_index"
                color="#16a34a"
                domain={[0, 6]}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}