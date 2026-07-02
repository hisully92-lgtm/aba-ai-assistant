"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Client = { id: string; full_name: string };
type Message = {
  id: string; client_id: string; user_id: string;
  message: string; sender_name: string | null;
  sender_role: string | null; created_at: string;
};

const QUICK_MESSAGES = [
  "Session started", "Session ended", "Running late",
  "Client not home", "Need supervisor", "Incident occurred",
];

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [assignedStaff, setAssignedStaff] = useState<{full_name: string; role: string}[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedClient) return;
    const channel = supabase.channel(`float-chat-${selectedClient.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "client_team_messages",
        filter: `client_id=eq.${selectedClient.id}`,
      }, (payload: { new: Message }) => {
        const msg = payload.new;
        setMessages(prev => [...prev, msg]);
        if (!open) setUnread(prev => prev + 1);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedClient, open]);

  useEffect(() => {
    if (open) { setUnread(0); setTimeout(() => bottomRef.current?.scrollIntoView(), 100); }
  }, [open]);

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
    const { data } = await supabase.from("clients")
      .select("id, full_name").eq("company_id", cu?.company_id).order("full_name");
    setClients(data ?? []);
  }

  async function selectClient(client: Client) {
    setSelectedClient(client);
    const { data } = await supabase.from("client_team_messages")
      .select("*").eq("client_id", client.id)
      .order("created_at", { ascending: true }).limit(50);
    setMessages(data ?? []);
  }

  async function handleSend(msg?: string) {
    const text = msg ?? input.trim();
    if (!text || !selectedClient) return;
    setSending(true);
    const optimistic: Message = {
      id: Date.now().toString(), client_id: selectedClient.id,
      user_id: userId, message: text,
      sender_name: userName, sender_role: userRole,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setInput("");
    const { error } = await supabase.from("client_team_messages").insert({
      client_id: selectedClient.id, user_id: userId,
      message: text, sender_name: userName, sender_role: userRole,
    });
    if (error) setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    setSending(false);
  }

  function roleBg(role: string | null) {
    if (role === "bcba" || role === "supervisor") return "#7c3aed";
    if (role === "admin") return "#dc2626";
    if (role === "rbt") return "#2563eb";
    return "#6b7280";
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
      {/* CHAT PANEL */}
      {open && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: "480px" }}>
          {/* HEADER */}
          <div className="bg-[#1a2234] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedClient && (
                <button onClick={() => { setSelectedClient(null); setMessages([]); }}
                  className="text-gray-400 hover:text-white text-lg leading-none">←</button>
              )}
              <div>
                <p className="text-white font-bold text-sm">
                  {selectedClient ? selectedClient.full_name : "Team Chat"}
                </p>
                <p className="text-gray-400 text-xs">
                  {selectedClient ? "Team chat" : `${clients.length} clients`}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
          </div>

          {!selectedClient ? (
            /* CLIENT LIST */
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {clients.map(client => (
                <button key={client.id} onClick={() => selectClient(client)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {client.full_name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-gray-800">{client.full_name}</span>
                  <span className="ml-auto text-gray-300">›</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* QUICK MESSAGES */}
              <div className="flex gap-1 p-2 overflow-x-auto border-b border-gray-100">
                {QUICK_MESSAGES.map(msg => (
                  <button key={msg} onClick={() => handleSend(msg)}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-blue-50 text-gray-600 rounded-full whitespace-nowrap shrink-0">
                    {msg}
                  </button>
                ))}
              </div>

              {/* MESSAGES */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-2xl mb-1">💬</p>
                    <p className="text-gray-400 text-xs">No messages yet</p>
                  </div>
                )}
                {messages.map(msg => {
                  const isMe = msg.user_id === userId;
                  return (
                    <div key={msg.id} className={`flex items-end gap-1.5 ${isMe ? "flex-row-reverse" : ""}`}>
                      {!isMe && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: roleBg(msg.sender_role) }}>
                          {(msg.sender_name ?? "?").charAt(0)}
                        </div>
                      )}
                      <div className={`max-w-[200px] rounded-2xl px-3 py-2 text-xs ${isMe ? "bg-blue-600 text-white rounded-br-sm" : "bg-white border border-gray-100 rounded-bl-sm"}`}>
                        {!isMe && <p className="font-bold mb-0.5 text-purple-600 text-xs">{msg.sender_name}</p>}
                        <p>{msg.message}</p>
                        <p className={`text-xs mt-0.5 ${isMe ? "text-blue-200" : "text-gray-400"}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* INPUT */}
              <div className="flex gap-2 p-2 border-t border-gray-100">
                <input type="text" value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  placeholder="Message..."
                  className="flex-1 border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                <button onClick={() => handleSend()} disabled={!input.trim() || sending}
                  className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm transition-colors">
                  →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* BUBBLE BUTTON */}
      <button onClick={() => setOpen(o => !o)}
        className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-all relative">
        {open ? "✕" : "💬"}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}
