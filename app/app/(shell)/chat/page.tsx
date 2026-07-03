"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/app/AppShell";

type Client = { id: string; full_name: string };
type Message = {
  id: string;
  client_id?: string;
  user_id: string;
  message: string;
  sender_name: string | null;
  sender_role: string | null;
  channel?: string;
  created_at: string;
};

type ChatMode = "team" | "students" | "supervisors";

const QUICK_MESSAGES = [
  "Question for supervisor",
  "Completed supervision hours",
  "Need MVF signed",
  "Available for session",
  "Submitted hours for review",
];

export default function ChatPage() {
  const [mode, setMode] = useState<ChatMode>("team");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [companyId, setCompanyId] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === "team" && selectedClient) {
      const channel = supabase.channel(`chat-${selectedClient.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "client_team_messages", filter: `client_id=eq.${selectedClient.id}` },
          (payload: any) => { setMessages(prev => [...prev, payload.new as Message]); setTimeout(scrollToEnd, 100); })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
    if (mode !== "team" && companyId) {
      const ch = supabase.channel(`student-chat-${companyId}-${mode}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "student_chat_messages", filter: `company_id=eq.${companyId}` },
          (payload: any) => {
            if (payload.new.channel === mode) {
              setMessages(prev => [...prev, payload.new as Message]);
              setTimeout(scrollToEnd, 100);
            }
          })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [selectedClient, mode, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== "team" && companyId) loadStudentMessages();
  }, [mode, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  function scrollToEnd() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);
    const [{ data: profile }, { data: cu }] = await Promise.all([
      supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
      supabase.from("company_users").select("company_id, role").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    ]);
    setUserName(profile?.full_name ?? "");
    setUserRole(cu?.role ?? profile?.role ?? "");
    setCompanyId(cu?.company_id ?? "");
    const { data } = await supabase.from("clients").select("id, full_name").eq("company_id", cu?.company_id);
    setClients(data ?? []);
    setLoading(false);
  }

  async function loadStudentMessages() {
    const { data } = await supabase.from("student_chat_messages")
      .select("*").eq("company_id", companyId).eq("channel", mode)
      .order("created_at", { ascending: true }).limit(100);
    setMessages(data ?? []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
  }

  async function selectClient(client: Client) {
    setSelectedClient(client);
    setMessages([]);
    const { data } = await supabase.from("client_team_messages").select("*").eq("client_id", client.id).order("created_at", { ascending: true }).limit(100);
    setMessages(data ?? []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
  }

  async function handleSend(quickMsg?: string) {
    const text = quickMsg ?? messageText.trim();
    if (!text) return;
    setSending(true);
    const optimistic: Message = {
      id: Date.now().toString(),
      user_id: userId,
      message: text,
      sender_name: userName,
      sender_role: userRole,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setMessageText("");
    setTimeout(scrollToEnd, 100);

    if (mode === "team" && selectedClient) {
      const { error } = await supabase.from("client_team_messages").insert({
        client_id: selectedClient.id, user_id: userId, message: text, sender_name: userName, sender_role: userRole,
      });
      if (error) { setMessages(prev => prev.filter(m => m.id !== optimistic.id)); alert(error.message); }
    } else {
      const { error } = await supabase.from("student_chat_messages").insert({
        company_id: companyId, user_id: userId, message: text, sender_name: userName, sender_role: userRole, channel: mode,
      });
      if (error) { setMessages(prev => prev.filter(m => m.id !== optimistic.id)); alert(error.message); }
    }
    setSending(false);
  }

  function roleColor(role: string | null) {
    if (role === "bcba" || role === "supervisor") return "#7c3aed";
    if (role === "admin" || role === "clinical_director") return "#dc2626";
    if (role === "student_analyst") return "#2563eb";
    if (role === "rbt") return "#0891b2";
    if (role === "bt") return "#16a34a";
    return "#6b7280";
  }

  if (loading) {
    return <AppShell title="Chat"><div className="flex justify-center py-20"><p className="text-gray-400 text-sm">Loading...</p></div></AppShell>;
  }

  return (
    <AppShell title="Chat">
      <div className="flex flex-col h-full">
        {/* MODE TABS */}
        <div className="flex bg-white border-b border-gray-100">
          {([
            { key: "team", label: "Team Chat" },
            { key: "students", label: "Students" },
            { key: "supervisors", label: "Supervisors" },
          ] as { key: ChatMode; label: string }[]).map(tab => (
            <button key={tab.key} onClick={() => { setMode(tab.key); setSelectedClient(null); setMessages([]); }}
              className="flex-1 py-3 text-center border-b-2" style={{ borderColor: mode === tab.key ? "#2563eb" : "transparent" }}>
              <span className="text-[13px] font-semibold" style={{ color: mode === tab.key ? "#2563eb" : "#6b7280" }}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TEAM CHAT — client selector */}
        {mode === "team" && !selectedClient && (
          <div className="p-4">
            <p className="text-sm text-gray-500 mb-4 font-medium">Select a client to view team chat</p>
            {clients.map(c => (
              <button key={c.id} onClick={() => selectClient(c)} className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 mb-2 shadow-sm text-left">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: "#2563eb" }}>{c.full_name.charAt(0)}</div>
                <span className="flex-1 text-[15px] font-semibold text-gray-900">{c.full_name}</span>
                <span className="text-xl text-gray-300">›</span>
              </button>
            ))}
          </div>
        )}

        {/* CHAT VIEW */}
        {(mode !== "team" || selectedClient) && (
          <>
            {mode === "team" && selectedClient && (
              <button onClick={() => { setSelectedClient(null); setMessages([]); }} className="w-full text-left px-4 py-2.5" style={{ backgroundColor: "#1a2234" }}>
                <span className="text-white text-[15px] font-semibold">‹ {selectedClient.full_name}</span>
              </button>
            )}

            {mode !== "team" && (
              <div className="px-4 py-2 border-b" style={{ backgroundColor: "#eff6ff", borderColor: "#dbeafe" }}>
                <p className="text-xs" style={{ color: "#3b82f6" }}>
                  {mode === "students" ? "🎓 Chat with other student analysts" : "👩‍🏫 Chat with BCBAs, supervisors, and directors"}
                </p>
              </div>
            )}

            {mode !== "team" && (
              <div className="flex gap-2 overflow-x-auto px-3 py-2 bg-white border-b border-gray-100">
                {QUICK_MESSAGES.map(msg => (
                  <button key={msg} onClick={() => handleSend(msg)} className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-full text-xs whitespace-nowrap text-gray-700">
                    {msg}
                  </button>
                ))}
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" style={{ minHeight: 300, maxHeight: "50vh" }}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center py-16">
                  <p className="text-4xl mb-3">💬</p>
                  <p className="text-sm text-gray-400 text-center">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map(item => {
                  const isMe = item.user_id === userId;
                  return (
                    <div key={item.id} className={`flex items-end gap-2 mb-3 ${isMe ? "flex-row-reverse" : ""}`}>
                      {!isMe && (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: roleColor(item.sender_role) }}>
                          {(item.sender_name ?? "?").charAt(0)}
                        </div>
                      )}
                      <div className="max-w-[75%] rounded-2xl p-3 shadow-sm" style={isMe ? { backgroundColor: "#2563eb", borderBottomRightRadius: 4 } : { backgroundColor: "#fff", borderBottomLeftRadius: 4 }}>
                        {!isMe && <p className="text-[11px] font-bold mb-1" style={{ color: roleColor(item.sender_role) }}>{item.sender_name ?? "Unknown"} · {item.sender_role?.toUpperCase()}</p>}
                        <p className="text-sm leading-relaxed" style={{ color: isMe ? "#fff" : "#111827" }}>{item.message}</p>
                        <p className="text-[10px] mt-1 text-right" style={{ color: isMe ? "#93c5fd" : "#9ca3af" }}>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-end gap-2 p-3 bg-white border-t border-gray-100">
              <textarea value={messageText} onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={mode === "team" ? "Message the team..." : mode === "students" ? "Message students..." : "Message supervisors..."}
                className="flex-1 border border-gray-300 rounded-2xl px-4 py-2.5 text-sm bg-gray-50 resize-none" style={{ maxHeight: 100 }} rows={1} />
              <button onClick={() => handleSend()} disabled={!messageText.trim() || sending}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0 disabled:opacity-50"
                style={{ backgroundColor: !messageText.trim() ? "#93c5fd" : "#2563eb" }}>
                ↑
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
