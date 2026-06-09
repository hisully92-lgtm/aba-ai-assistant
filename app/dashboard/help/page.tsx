"use client";

import { useEffect, useRef, useState } from "react";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const QUICK_QUESTIONS = [
  "How do I log a behavior?",
  "What CPT codes are used for ABA?",
  "How do I complete a session note?",
  "What is the difference between DTT and NET?",
  "How do I submit an insurance claim?",
  "What is a functional behavior assessment?",
  "How do I add a new client?",
  "How do I invite a team member?",
];

const SYSTEM_CONTEXT = `You are a helpful assistant for an ABA (Applied Behavior Analysis) clinical software platform called ABA AI Assistant. 
You help clinicians, RBTs, BCBAs, and supervisors navigate the platform and answer clinical ABA questions.

The platform has these main sections:
- Session Notes: Log ABA sessions with behaviors, interventions, and programs
- Behavior Interventions: Track ABC data, frequency, duration, intensity
- Skill Programs: Manage DTT programs, prompt levels, mastery criteria, targets
- Clients/Learners: Add and manage client profiles
- Schedule: Calendar view with session scheduling
- Time Tracking: Timer with CPT code and insurance billing integration
- Signatures: Collect provider and caregiver signatures
- Geofence: Location verification for session clock-in
- Insurance: Claims, authorizations, CPT codes
- Payroll: Session hours and payroll export
- Team Chat: Team messaging and supervisor pings
- Notifications: Alerts and messages
- Parent Portal: Session summaries for parents/caregivers
- AI Clinical Assistant: AI-powered session summaries and timelines
- Clinical Suggestions: Risk-based clinical recommendations
- Reports: PDF clinical reports
- SAFMEDS: ABA flashcard study tool

Answer questions helpfully and concisely. For platform navigation, give step-by-step instructions.`;

export default function HelpPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your ABA AI Assistant help bot. I can answer questions about the platform or ABA clinical concepts. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const msg = text ?? input.trim();
    if (!msg) return;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          system: SYSTEM_CONTEXT,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: msg },
          ],
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text ?? "Sorry, I couldn't process that. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Help Center">
        <p className="text-gray-500 text-sm">Get answers about the platform and ABA clinical concepts.</p>
      </PageHeader>

      {/* CONTACT SUPPORT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-blue-100 bg-blue-50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">💬</span>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">General Inquiries</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">Questions about ABA AI Assistant, features, or getting started.</p>
          <a href="mailto:hello@aba-ai-assistant.com" className="text-sm font-semibold text-blue-600 hover:underline break-all">
            hello@aba-ai-assistant.com
          </a>
        </div>
        <div className="border border-green-100 bg-green-50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🛠️</span>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">Technical Support</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">Having trouble with the platform? Report bugs or get technical help.</p>
          <a href="mailto:support@aba-ai-assistant.com" className="text-sm font-semibold text-blue-600 hover:underline break-all">
            support@aba-ai-assistant.com
          </a>
        </div>
        <div className="border border-purple-100 bg-purple-50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">💳</span>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700">Billing Support</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">Questions about your subscription, payments, or account billing.</p>
          <a href="mailto:support@aba-ai-assistant.com" className="text-sm font-semibold text-blue-600 hover:underline break-all">
            support@aba-ai-assistant.com
          </a>
        </div>
      </div>

      {/* RESPONSE TIMES */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span className="text-green-500 font-bold">●</span>
          <span>General inquiries — response within 24 hours</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-blue-500 font-bold">●</span>
          <span>Technical support — response within 12 hours</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-purple-500 font-bold">●</span>
          <span>Billing support — response within 24 hours</span>
        </div>
      </div>

      {/* DISCLAIMER */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-800">
        <p className="font-bold mb-1">Important Notice</p>
        <p>ABA AI Assistant is a clinical documentation and practice management platform. It does not currently support direct electronic claims submission (EDI 837) to insurance payers. Claims submission requires your existing billing software or clearinghouse (such as Availity, Office Ally, or Change Healthcare). Your clinicians are responsible for their own provider credentialing with individual insurance companies. ABA AI Assistant is not a billing service and does not guarantee insurance reimbursement.</p>
      </div>

      {/* QUICK QUESTIONS */}
      <Section title="Common Questions">
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="text-xs px-3 py-2 border border-gray-200 rounded-full text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </Section>

      {/* CHAT */}
      <Section title="Ask a Question">
        <div className="flex flex-col" style={{ height: "420px" }}>
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-sm px-4 py-3 rounded-2xl text-sm ${
                  msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
                }`}>
                  {msg.role === "assistant" && (
                    <p className="text-xs font-semibold text-blue-600 mb-1">ABA AI Assistant</p>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl text-sm bg-gray-100 text-gray-500">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask a question..."
              disabled={sending}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <Button onClick={() => handleSend()} loading={sending}>Ask</Button>
          </div>
        </div>
      </Section>
    </div>
  );
}