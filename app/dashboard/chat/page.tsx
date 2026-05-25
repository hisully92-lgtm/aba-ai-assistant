"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Message = {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  type: string;
};

type Profile = { id: string; full_name: string | null; role: string | null };

const QUICK_MESSAGES = [
  "Session started",
  "Session ended",
  "Running 5 minutes late",
  "Client not home",
  "Need supervisor assistance",
  "Incident occurred",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeChannel, setActiveChannel] = useState<"team" | "supervisor">("team");
  const [unreadPings, setUnreadPings] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) setUserId(auth.user.id);
      await loadMessages();
      await loadProfiles();

      supabase
        .channel("chat-realtime")
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `type=in.(chat,ping,supervisor)`,
        }, () => loadMessages())
        .subscribe();
    }
    init();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages() {
    const types = activeChannel === "team" ? ["chat", "ping"] : ["supervisor"];
    const { data } = await supabase
      .from("notifications")
      .select("id, user_id, message, type, created_at")
      .in("type", types)
      .order("created_at", { ascending: true })
      .limit(100);

    setMessages(data ?? []);

    const pings = (data ?? []).filter((m) => m.type === "ping").length;
    setUnreadPings(pings);
    setLoading(false);
  }

  async function loadProfiles() {
    const { data } = await supabase.from("profiles").select("id, full_name, role");
    const map = new Map((data ?? []).map((p: Profile) => [p.id, p]));
    setProfiles(map);
  }

  useEffect(() => { loadMessages(); }, [activeChannel]);

  async function handleSend(type: "chat" | "ping" | "supervisor" = "chat") {
    if (!input.trim() || !userId) return;
    setSending(true);

    await supabase.from("notifications").insert({
      user_id: userId,
      message: input.trim(),
      type,
      read: false,
    });

    setInput("");
    setSending(false);
  }

  async function sendQuick(msg: string) {
    if (!userId) return;
    await supabase.from("notifications").insert({
      user_id: userId,
      message: msg,
      type: "chat",
      read: false,
    });
  }

  function getDisplayName(uid: string) {
    const profile = profiles.get(uid);
    if (profile?.full_name) return profile.full_name;
    if (uid === userId) return "You";
    return "Team Member";
  }

  function getBubbleColor(msg: Message) {
    if (msg.type === "ping") return "bg-orange-100 text-orange-800 border border-orange-200";
    if (msg.type === "supervisor") return "bg-purple-100 text-purple-800 border border-purple-200";
    if (msg.user_id === userId) return "bg-blue-600 text-white";
    return "bg-gray-100 text-gray-800";
  }

  function getTypeLabel(type: string) {
    if (type === "ping") return "🔔 PING";
    if (type === "supervisor") return "📢 SUPERVISOR";
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Team Communication">
        <p className="text-gray-500 text-sm">Real-time team messaging and alerts.</p>
      </PageHeader>

      {/* CHANNEL TABS */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveChannel("team")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeChannel === "team" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          Team Chat
        </button>
        <button
          onClick={() => setActiveChannel("supervisor")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeChannel === "supervisor" ? "border-purple-500 text-purple-600" : "border-transparent text-gray-500"
          }`}
        >
          Supervisor Channel
          {unreadPings > 0 && (
            <span className="ml-2 bg-orange-500 text-white text-xs rounded-full px-1.5">
              {unreadPings}
            </span>
          )}
        </button>
      </div>

      {/* QUICK MESSAGES */}
      {activeChannel === "team" && (
        <div className="flex flex-wrap gap-2">
          {QUICK_MESSAGES.map((msg) => (
            <button
              key={msg}
              onClick={() => sendQuick(msg)}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              {msg}
            </button>
          ))}
        </div>
      )}

      {/* MESSAGES */}
      <Section title={activeChannel === "team" ? "Team Chat" : "Supervisor Channel"}>
        <div className="flex flex-col" style={{ height: "420px" }}>
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
            {loading && <p className="text-gray-400 text-sm">Loading messages...</p>}
            {!loading && messages.length === 0 && (
              <p className="text-gray-400 text-sm">No messages yet.</p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.user_id === userId ? "items-end" : "items-start"}`}
              >
                <p className="text-xs text-gray-400 mb-1 px-1">
                  {getDisplayName(msg.user_id)}
                </p>
                <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${getBubbleColor(msg)}`}>
                  {getTypeLabel(msg.type) && (
                    <span className="font-bold mr-1 text-xs">{getTypeLabel(msg.type)}:</span>
                  )}
                  {msg.message}
                  <p className={`text-xs mt-1 ${msg.user_id === userId ? "text-blue-200" : "text-gray-400"}`}>
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* INPUT */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend(activeChannel === "supervisor" ? "supervisor" : "chat")}
              placeholder="Type a message..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <Button
              onClick={() => handleSend(activeChannel === "supervisor" ? "supervisor" : "chat")}
              loading={sending}
            >
              Send
            </Button>
            {activeChannel === "team" && (
              <Button variant="outline" onClick={() => handleSend("ping")} loading={sending}>
                🔔 Ping
              </Button>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}