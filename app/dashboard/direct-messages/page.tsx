"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Profile = { id: string; full_name: string | null; role: string | null };
type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  read: boolean;
  created_at: string;
};

export default function DirectMessagesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedUserId || !userId) return;
    loadConversation(selectedUserId);

    const channel = supabase.channel(`dm-${userId}-${selectedUserId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
      }, () => loadConversation(selectedUserId))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedUserId, userId]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .neq("id", user.id);

    setProfiles(profileData ?? []);

    // Load unread counts
    const { data: unread } = await supabase
      .from("direct_messages")
      .select("sender_id")
      .eq("recipient_id", user.id)
      .eq("read", false);

    const counts: Record<string, number> = {};
    (unread ?? []).forEach((m: { sender_id: string }) => {
      counts[m.sender_id] = (counts[m.sender_id] ?? 0) + 1;
    });
    setUnreadCounts(counts);
    setLoading(false);
  }

  async function loadConversation(recipientId: string) {
    if (!userId) return;

    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${userId})`)
      .order("created_at", { ascending: true });

    setMessages(data ?? []);

    // Mark as read
    await supabase.from("direct_messages")
      .update({ read: true })
      .eq("sender_id", recipientId)
      .eq("recipient_id", userId)
      .eq("read", false);

    setUnreadCounts((prev) => ({ ...prev, [recipientId]: 0 }));
  }

  async function handleSend() {
    if (!input.trim() || !userId || !selectedUserId) return;
    setSending(true);

    await supabase.from("direct_messages").insert({
      sender_id: userId,
      recipient_id: selectedUserId,
      message: input.trim(),
      read: false,
    });

    setInput("");
    setSending(false);
  }

  const selectedProfile = profiles.find((p) => p.id === selectedUserId);
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={`Direct Messages${totalUnread > 0 ? ` (${totalUnread})` : ""}`}>
        <p className="text-gray-500 text-sm">One-on-one messaging with team members.</p>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CONTACTS */}
        <Section title="Team Members">
          {loading && <p className="text-gray-400 text-sm">Loading...</p>}
          <div className="space-y-1">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedUserId(p.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex justify-between items-center ${
                  selectedUserId === p.id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.full_name ?? "Team Member"}</p>
                  {p.role && <p className="text-xs text-gray-400 capitalize">{p.role}</p>}
                </div>
                {(unreadCounts[p.id] ?? 0) > 0 && (
                  <span className="bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5">
                    {unreadCounts[p.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Section>

        {/* CONVERSATION */}
        <div className="md:col-span-2">
          <Section title={selectedProfile ? `Chat with ${selectedProfile.full_name ?? "Team Member"}` : "Select a contact"}>
            {!selectedUserId ? (
              <p className="text-gray-400 text-sm">Select a team member to start a conversation.</p>
            ) : (
              <div className="flex flex-col" style={{ height: "420px" }}>
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                  {messages.length === 0 && (
                    <p className="text-gray-400 text-sm">No messages yet. Say hello!</p>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                        msg.sender_id === userId ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
                      }`}>
                        {msg.message}
                        <p className={`text-xs mt-1 ${msg.sender_id === userId ? "text-blue-200" : "text-gray-400"}`}>
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder={`Message ${selectedProfile?.full_name ?? ""}...`}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <Button onClick={handleSend} loading={sending}>Send</Button>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}