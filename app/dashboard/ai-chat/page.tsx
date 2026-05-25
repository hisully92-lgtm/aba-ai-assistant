"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { useAIStream } from "@/lib/hooks/useAIStream";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const { text, loading, done, stream, reset } = useAIStream();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) setUserId(auth.user.id);

      const { data } = await supabase.from("clients").select("id, full_name").limit(20);
      setClients(data ?? []);
    }
    init();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, text]);

  useEffect(() => {
    if (done && text) {
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
      reset();
    }
  }, [done]);

  async function handleSend() {
    if (!input.trim() || !clientId) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");

    await stream("summary", clientId);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AI Clinical Assistant">
        <p className="text-gray-500 text-sm">Ask clinical questions about your clients.</p>
      </PageHeader>

      <Section title="Select Client">
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-64"
        >
          <option value="">Select a client...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
      </Section>

      <Section title="Chat">
        <div className="flex flex-col h-96">
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {messages.length === 0 && (
              <p className="text-gray-400 text-sm">
                Select a client and ask a clinical question to get started.
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-sm px-4 py-2 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* STREAMING */}
            {loading && text && (
              <div className="flex justify-start">
                <div className="max-w-sm px-4 py-2 rounded-2xl text-sm bg-gray-100 text-gray-800">
                  {text}
                  <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse rounded-sm" />
                </div>
              </div>
            )}
            {loading && !text && (
              <div className="flex justify-start">
                <div className="px-4 py-2 rounded-2xl text-sm bg-gray-100 text-gray-500">
                  Thinking...
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
              placeholder={clientId ? "Ask a clinical question..." : "Select a client first"}
              disabled={!clientId || loading}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
            />
            <Button onClick={handleSend} loading={loading} disabled={!clientId}>
              Send
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}