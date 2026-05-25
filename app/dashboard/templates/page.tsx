"use client";

import { useState } from "react";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

const TEMPLATES = [
  {
    id: "1",
    name: "Standard ABA Session",
    description: "Basic session note with behaviors, interventions, and client response.",
    fields: ["behaviors_observed", "interventions_used", "client_response", "programs_targeted"],
  },
  {
    id: "2",
    name: "Behavior Incident Report",
    description: "Detailed ABC data collection for behavioral incidents.",
    fields: ["antecedent", "behavior", "consequence", "intensity", "duration"],
  },
  {
    id: "3",
    name: "Skill Acquisition Session",
    description: "Focus on skill programs, prompt levels, and trial data.",
    fields: ["programs_targeted", "prompt_level", "trial_data", "mastery_criteria"],
  },
  {
    id: "4",
    name: "Parent Training Session",
    description: "Document parent training activities and generalization goals.",
    fields: ["training_topic", "parent_response", "generalization_goals", "next_steps"],
  },
];

export default function TemplatesPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Session Templates">
        <p className="text-gray-500 text-sm">Choose a template to start a new session note.</p>
      </PageHeader>

      <Section title="Available Templates">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((template) => (
            <div
              key={template.id}
              onClick={() => setSelected(template.id)}
              className={`border rounded-xl p-4 cursor-pointer transition-all ${
                selected === template.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50"
              }`}
            >
              <p className="font-semibold text-gray-800">{template.name}</p>
              <p className="text-sm text-gray-500 mt-1">{template.description}</p>
              <div className="flex flex-wrap gap-1 mt-3">
                {template.fields.map((field) => (
                  <span
                    key={field}
                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
                  >
                    {field.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="mt-4">
            <Button onClick={() => window.location.href = "/dashboard"}>
              Use This Template
            </Button>
          </div>
        )}
      </Section>
    </div>
  );
}