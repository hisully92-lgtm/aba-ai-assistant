"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Message = {
  id: string;
  client_id: string;
  user_id: string;
  message: string;
  sender_name: string | null;
  sender_role: string | null;
  created_at: string;
};

const QUICK_MESSAGES = [
  "Session started",
  "Session ended",
  "Running 5 minutes late",
  "Client not home",
  "Need supervisor assistance",
  "Incident occurred",
];

export default function ChatPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedClient) return;
    const channel = supabase
      .channel(`chat-${selectedClient.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "client_team_messages",
          filter: `client_id=eq.${selectedClient.id}`,
        },
        (payload: { new: Message }) => {
          setMessages((prev) => [...prev, payload.new]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedClient]);

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

    const { data: clientData } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("company_id", cu?.company_id)
      .order("full_name");
    setClients(clientData ?? []);
    setLoading(false);
  }

  async function selectClient(client: Client) {
    setSelectedClient(client);
    setMessages([]);
    const { data } = await supabase
      .from("client_team_messages")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages(data ?? []);
  }

  async function handleSend(msg?: string) {
    const text = msg ?? input.trim();
    if (!text || !selectedClient) return;
    setSending(true);
    const optimistic: Message = {
      id: Date.now().toString(),
      client_id: selectedClient.id,
      user_id: userId,
      message: text,
      sender_name: userName,
      sender_role: userRole,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    const { error } = await supabase.from("client_team_messages").insert({
      client_id: selectedClient.id,
      user_id: userId,
      message: text,
      sender_name: userName,
      sender_role: userRole,
    });
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
    setSending(false);
  }

  function roleColor(role: string | null) {
    if (role === "bcba" || role === "supervisor") return "text-purple-700";
    if (role === "admin" || role === "clinical_director") return "text-red-600";
    if (role === "rbt") return "text-blue-600";
    return "text-gray-500";
  }

  function roleBg(role: string | null) {
    if (role === "bcba" || role === "supervisor") return "bg-purple-600";
    if (role === "admin" || role === "clinical_director") return "bg-red-600";
    if (role === "rbt") return "bg-blue-600";
    return "bg-gray-500";
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  if (!selectedClient) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team Chat" />
        <p className="text-sm text-gray-500">Select a client to view the team chat for that client.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => selectClient(client)}
              className="bg-white border border-gray-100 hover:border-blue-300 rounded-xl p-4 text-left transition-all flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">
                {client.full_name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-800">{client.full_name}</p>
                <p className="text-xs text-gray-400">View team chat</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setSelectedClient(null)}
          className="text-blue-500 hover:underline text-sm"
        >
          ← Back
        </button>
        <h2 className="font-bold text-gray-800">{selectedClient.full_name} — Team Chat</h2>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_MESSAGES.map((msg) => (
          <button
            key={msg}
            onClick={() => handleSend(msg)}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 rounded-full border border-gray-200 transition-colors"
          >
            {msg}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3 mb-3">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-gray-400 text-sm">Start the conversation with your team</p>
          </div>
        )}
        {messages.map((msg) => {
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
                    {msg.sender_name ?? "Team"} · {msg.sender_role?.toUpperCase()}
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

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Message the team..."
          className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <Button onClick={() => handleSend()} loading={sending} disabled={!input.trim()}>
          Send →
        </Button>
      </div>
    </div>
  );
}