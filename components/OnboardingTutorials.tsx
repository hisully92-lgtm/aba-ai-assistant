"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    title: "Welcome to ABA AI!",
    desc: "Let's take a quick tour of the platform. This will only take 2 minutes.",
    icon: "👋",
  },
  {
    title: "Add Your First Client",
    desc: "Go to Clients / Learners in the sidebar to create a client profile with diagnosis, goals, and caregiver info.",
    icon: "👤",
    href: "/dashboard/clients/new",
    action: "Add Client",
  },
  {
    title: "Log Session Notes",
    desc: "After each session, log your notes from the Sessions page. You can also generate AI-assisted notes.",
    icon: "📋",
    href: "/dashboard/sessions",
    action: "Go to Sessions",
  },
  {
    title: "Collect Behavior Data",
    desc: "Use the Data Collection hub for frequency, duration, ABC, and interval recording — all in one place.",
    icon: "📊",
    href: "/dashboard/data-collection",
    action: "Open Data Collection",
  },
  {
    title: "Set Up Goals",
    desc: "Create and track client goals with baseline, target, and mastery criteria. Generalization tracking is built in.",
    icon: "🎯",
    href: "/dashboard/goals",
    action: "Go to Goals",
  },
  {
    title: "You're ready!",
    desc: "Explore the sidebar to discover all features — BIP plans, visual supports, scheduling, billing, and more.",
    icon: "🎉",
  },
];

export default function OnboardingTutorial() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem("aba_onboarding_done");
    if (!done) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem("aba_onboarding_done", "true");
    setVisible(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  }

  function prev() {
    setStep(s => Math.max(0, s - 1));
  }

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 space-y-6">

        {/* PROGRESS */}
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-blue-500" : "bg-gray-200"}`} />
          ))}
        </div>

        {/* CONTENT */}
        <div className="text-center space-y-3">
          <p className="text-5xl">{current.icon}</p>
          <h2 className="text-xl font-bold text-gray-800">{current.title}</h2>
          <p className="text-sm text-gray-500 leading-relaxed">{current.desc}</p>
        </div>

        {/* ACTION BUTTON */}
        {current.href && current.action && (
          <a href={current.href}
            className="block w-full text-center bg-blue-50 border border-blue-200 text-blue-700 font-medium py-2.5 rounded-xl text-sm hover:bg-blue-100 transition-colors">
            {current.action} →
          </a>
        )}

        {/* NAV */}
        <div className="flex justify-between items-center">
          <button onClick={dismiss} className="text-xs text-gray-400 hover:text-gray-600">
            Skip tutorial
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={prev}
                className="px-4 py-2 text-sm border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">
                Back
              </button>
            )}
            <button onClick={next}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
              {step === STEPS.length - 1 ? "Get Started" : "Next"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-300">{step + 1} of {STEPS.length}</p>
      </div>
    </div>
  );
}