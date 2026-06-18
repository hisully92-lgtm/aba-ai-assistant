"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Message = {
  id: string;
  user_id: string;
  message: string;
  sender_name: string | null;
  sender_role: string | null;
  channel: string;
  created_at: string;
};

const QUICK_MESSAGES = [
  "Question for supervisor",
  "Completed supervision hours",
  "Need MVF signed",
  "Available for session",
  "Submitted hours for review",
];

export default function StudentChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState<"students" | "supervisors">("students");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ch = supabase.channel(`student-chat-${companyId}-${channel}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "student_chat_messages",
        filter: `company_id=eq.${companyId}`,
      }, (payload: { new: Message }) => {
        if (payload.new.channel === channel) {
          setMessages(prev => [...prev, payload.new]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyId, channel]);

  useEffect(() => {
    if (companyId) loadMessages();
  }, [channel, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const [{ data: profile }, { data: cu }] = await Promise.all([
      supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
      supabase.from("company_users").select("company_id, role")
        .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    ]);

    setUserName(profile?.full_name ?? "");
    setUserRole(cu?.role ?? profile?.role ?? "");
    setCompanyId(cu?.company_id ?? "");
    setLoading(false);
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("student_chat_messages")
      .select("*")
      .eq("company_id", companyId)
      .eq("channel", channel)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages(data ?? []);
  }

  async function handleSend(msg?: string) {
    const text = msg ?? input.trim();
    if (!text || !companyId) return;
    setSending(true);
    const optimistic: Message = {
      id: Date.now().toString(), user_id: userId,
      message: text, sender_name: userName,
      sender_role: userRole, channel,
      created_at: new Date().toISOString(),
      company_id: companyId,
    } as any;
    setMessages(prev => [...prev, optimistic]);
    setInput("");
    const { error } = await supabase.from("student_chat_messages").insert({
      user_id: userId, message: text,
      sender_name: userName, sender_role: userRole,
      channel, company_id: companyId,
    });
    if (error) setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    setSending(false);
  }

  function roleBg(role: string | null) {
    if (role === "bcba" || role === "supervisor") return "bg-purple-600";
    if (role === "clinical_director") return "bg-red-600";
    if (role === "student_analyst") return "bg-blue-600";
    return "bg-gray-500";
  }

  function roleColor(role: string | null) {
    if (role === "bcba" || role === "supervisor") return "text-purple-700";
    if (role === "clinical_director") return "text-red-600";
    if (role === "student_analyst") return "text-blue-600";
    return "text-gray-500";
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      <PageHeader title="Student Hub Chat" />

      {/* CHANNEL TABS */}
      <div className="flex gap-2 border-b border-gray-200 mb-3">
        <button onClick={() => setChannel("students")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${channel === "students" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"}`}>
          🎓 Student Channel
        </button>
        <button onClick={() => setChannel("supervisors")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${channel === "supervisors" ? "border-purple-500 text-purple-600" : "border-transparent text-gray-500"}`}>
          👩‍🏫 Supervisor Channel
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        {channel === "students"
          ? "Chat with other student analysts in your company."
          : "Chat with BCBAs, supervisors, and clinical directors."}
      </p>

      {/* QUICK MESSAGES */}
      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_MESSAGES.map(msg => (
          <button key={msg} onClick={() => handleSend(msg)}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 rounded-full border border-gray-200 transition-colors">
            {msg}
          </button>
        ))}
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3 mb-3">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-gray-400 text-sm">Start the conversation!</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.user_id === userId;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              {!isMe && (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${roleBg(msg.sender_role)}`}>
                  {(msg.sender_name ?? "?").charAt(0)}
                </div>
              )}
              <div className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 ${isMe ? "bg-blue-600 text-white rounded-br-sm" : "bg-white border border-gray-100 rounded-bl-sm"}`}>
                {!isMe && (
                  <p className={`text-xs font-bold mb-1 ${roleColor(msg.sender_role)}`}>
                    {msg.sender_name} · {msg.sender_role?.toUpperCase()}
                  </p>
                )}
                <p className={`text-sm ${isMe ? "text-white" : "text-gray-800"}`}>{msg.message}</p>
                <p className={`text-xs mt-1 ${isMe ? "text-blue-200" : "text-gray-400"}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div className="flex gap-2">
        <input type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Message..."
          className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <Button onClick={() => handleSend()} loading={sending} disabled={!input.trim()}>
          Send →
        </Button>
      </div>
    </div>
  );
}
