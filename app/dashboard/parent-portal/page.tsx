"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

type SessionSummary = {
  id: string;
  created_at: string;
  date: string | null;
  notes: string | null;
  status: string;
  behaviors_observed: string | null;
  programs_targeted: string | null;
};

type Document = {
  id: string;
  name: string;
  file_url: string | null;
  file_type: string | null;
  created_at: string;
};

type Message = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

type Reminder = {
  id: string;
  title: string;
  message: string | null;
  remind_at: string;
};

export default function ParentPortalPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "progress" | "documents" | "messages" | "reminders">("sessions");
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    setClientName(profile?.full_name ?? null);

    const [
      { data: sessionData },
      { data: docData },
      { data: msgData },
      { data: reminderData },
    ] = await Promise.all([
      supabase.from("sessions")
        .select("id, created_at, date, notes, status, behaviors_observed, programs_targeted")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("documents")
        .select("id, name, file_url, file_type, created_at")
        .eq("visible_to_parent", true)
        .order("created_at", { ascending: false }),
      supabase.from("notifications")
        .select("id, user_id, message, created_at")
        .eq("user_id", user.id)
        .in("type", ["parent_message", "chat"])
        .order("created_at", { ascending: true })
        .limit(50),
      supabase.from("reminders")
        .select("id, title, message, remind_at")
        .eq("user_id", user.id)
        .gte("remind_at", new Date().toISOString())
        .order("remind_at", { ascending: true }),
    ]);

    setSessions(sessionData ?? []);
    setDocuments(docData ?? []);
    setMessages((msgData ?? []).map((m: any) => ({
      id: m.id,
      sender_id: m.user_id,
      message: m.message,
      created_at: m.created_at,
    })));
    setReminders(reminderData ?? []);
    setLoading(false);

    // Realtime messages
    supabase.channel("parent-messages")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => init())
      .subscribe();
  }

  async function handleSendMessage() {
    if (!messageInput.trim() || !userId) return;
    setSending(true);

    await supabase.from("notifications").insert({
      user_id: userId,
      message: messageInput.trim(),
      type: "parent_message",
      read: false,
    });

    setMessageInput("");
    setSending(false);
  }

  // PROGRESS CHART DATA — program accuracy over time
  const progressData = sessions
    .filter((s) => s.programs_targeted)
    .map((s, i) => ({
      session: `S${i + 1}`,
      date: s.date ?? new Date(s.created_at).toLocaleDateString(),
      programs: (s.programs_targeted ?? "").split(",").length,
      behaviors: (s.behaviors_observed ?? "").split(",").filter((b) => b.trim() && b.trim() !== "No behaviors observed").length,
    }))
    .reverse()
    .slice(-10);

  const attendanceTotal = sessions.length;
  const attendanceCompleted = sessions.filter((s) => s.status === "completed").length;
  const attendanceRate = attendanceTotal ? Math.round((attendanceCompleted / attendanceTotal) * 100) : 0;

  const TABS = [
    { key: "sessions", label: "Sessions" },
    { key: "progress", label: "Progress" },
    { key: "documents", label: "Documents" },
    { key: "messages", label: "Messages" },
    { key: "reminders", label: "Reminders" },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Parent Portal">
        <p className="text-gray-500 text-sm">
          {clientName ? `Welcome, ${clientName}` : "View your child's therapy progress."}
        </p>
      </PageHeader>

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-blue-600">{attendanceTotal}</p>
          <p className="text-xs text-gray-500 mt-1">Total Sessions</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-green-600">{attendanceRate}%</p>
          <p className="text-xs text-gray-500 mt-1">Attendance Rate</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-purple-600">{documents.length}</p>
          <p className="text-xs text-gray-500 mt-1">Documents</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-white">
          <p className="text-2xl font-bold text-orange-500">{reminders.length}</p>
          <p className="text-xs text-gray-500 mt-1">Upcoming</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {/* SESSIONS TAB */}
      {!loading && activeTab === "sessions" && (
        <Section title={`Sessions (${sessions.length})`}>
          {sessions.length === 0 ? (
            <p className="text-gray-400 text-sm">No sessions recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-gray-800">
                      {s.date
                        ? new Date(s.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                        : new Date(s.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                      }
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      s.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  {s.behaviors_observed && (
                    <p className="text-sm text-gray-600 mt-2">
                      <span className="font-medium">Behaviors:</span> {s.behaviors_observed}
                    </p>
                  )}
                  {s.programs_targeted && (
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">Programs:</span> {s.programs_targeted}
                    </p>
                  )}
                  {s.notes && (
                    <p className="text-sm text-gray-500 mt-1 italic">{s.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* PROGRESS TAB */}
      {!loading && activeTab === "progress" && (
        <>
          <Section title="Attendance">
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-gray-100 rounded-full h-4">
                <div
                  className="bg-green-500 h-4 rounded-full transition-all"
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-700">{attendanceRate}%</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {attendanceCompleted} completed out of {attendanceTotal} sessions
            </p>
          </Section>

          <Section title="Session Activity">
            {progressData.length < 2 ? (
              <p className="text-gray-400 text-sm">Need more sessions to show a progress chart.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="session" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="programs" stroke="#2563eb" strokeWidth={2} name="Programs" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="behaviors" stroke="#dc2626" strokeWidth={2} name="Behaviors" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-gray-400 mt-2 text-center">
              Blue = programs targeted · Red = behaviors observed per session
            </p>
          </Section>
        </>
      )}

      {/* DOCUMENTS TAB */}
      {!loading && activeTab === "documents" && (
        <Section title={`Documents (${documents.length})`}>
          {documents.length === 0 ? (
            <p className="text-gray-400 text-sm">No documents shared yet.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="border border-gray-100 rounded-lg p-3 bg-white flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {doc.file_type ?? "Document"} · {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {doc.file_url && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(doc.file_url!, "_blank")}
                    >
                      View
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* MESSAGES TAB */}
      {!loading && activeTab === "messages" && (
        <Section title="Messages">
          <div className="flex flex-col" style={{ height: "360px" }}>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
              {messages.length === 0 && (
                <p className="text-gray-400 text-sm">No messages yet. Send a message to your therapy team.</p>
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
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Message your therapy team..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <Button onClick={handleSendMessage} loading={sending}>Send</Button>
            </div>
          </div>
        </Section>
      )}

      {/* REMINDERS TAB */}
      {!loading && activeTab === "reminders" && (
        <Section title={`Upcoming Appointments (${reminders.length})`}>
          {reminders.length === 0 ? (
            <p className="text-gray-400 text-sm">No upcoming appointments.</p>
          ) : (
            <div className="space-y-2">
              {reminders.map((r) => (
                <div key={r.id} className="border border-blue-100 rounded-lg p-4 bg-blue-50">
                  <p className="font-medium text-blue-800">{r.title}</p>
                  {r.message && <p className="text-sm text-blue-600 mt-0.5">{r.message}</p>}
                  <p className="text-xs text-blue-400 mt-1">
                    {new Date(r.remind_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}