"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Client = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
};

type Session = {
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

export default function ParentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<"sessions" | "progress" | "documents">("sessions");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { router.push("/parent"); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "parent") {
      router.push("/dashboard");
      return;
    }

    setParentName(profile?.full_name ?? "");

    // Find clients linked to this parent
    const { data: clientData } = await supabase
      .from("clients")
      .select("id, full_name, date_of_birth")
      .eq("parent_user_id", user.id)
      .order("full_name");

    const clientList = clientData ?? [];
    setClients(clientList);

    if (clientList.length > 0) {
      await loadClientData(clientList[0]);
    }

    setLoading(false);
  }

  async function loadClientData(client: Client) {
    setSelectedClient(client);

    const [{ data: sessionData }, { data: docData }] = await Promise.all([
      supabase.from("sessions")
        .select("id, created_at, date, notes, status, behaviors_observed, programs_targeted")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("documents")
        .select("id, name, file_url, file_type, created_at")
        .eq("client_id", client.id)
        .eq("visible_to_parent", true)
        .order("created_at", { ascending: false }),
    ]);

    setSessions(sessionData ?? []);
    setDocuments(docData ?? []);
  }

  async function handleSendMessage() {
    if (!message.trim() || !selectedClient) return;
    setSending(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    await supabase.from("notifications").insert({
      user_id: user?.id,
      message: `[Parent message about ${selectedClient.full_name}]: ${message.trim()}`,
      type: "parent_message",
      read: false,
    });

    setMessage("");
    setMessageSent(true);
    setTimeout(() => setMessageSent(false), 3000);
    setSending(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/parent");
  }

  const progressData = sessions
    .filter(s => s.programs_targeted)
    .map((s, i) => ({
      session: `S${i + 1}`,
      programs: (s.programs_targeted ?? "").split(",").length,
      behaviors: (s.behaviors_observed ?? "").split(",").filter(b => b.trim() && b.trim() !== "No behaviors observed").length,
    }))
    .reverse()
    .slice(-10);

  const completed = sessions.filter(s => s.status === "completed").length;
  const attendanceRate = sessions.length ? Math.round((completed / sessions.length) * 100) : 0;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">Loading your portal...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">ABA AI Parent Portal</h1>
            {parentName && <p className="text-xs text-gray-500">Welcome, {parentName}</p>}
          </div>
          <button onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* CLIENT SELECTOR */}
        {clients.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl bg-white">
            <p className="text-4xl mb-3">👶</p>
            <p className="font-semibold text-gray-700">No clients linked to your account</p>
            <p className="text-sm text-gray-400 mt-1">Contact your clinic to link your child&apos;s profile.</p>
          </div>
        ) : (
          <>
            {clients.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {clients.map(c => (
                  <button key={c.id} onClick={() => loadClientData(c)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedClient?.id === c.id ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                    {c.full_name}
                  </button>
                ))}
              </div>
            )}

            {selectedClient && (
              <>
                {/* STATS */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white border rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{sessions.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Sessions</p>
                  </div>
                  <div className="bg-white border rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{attendanceRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">Attendance</p>
                  </div>
                  <div className="bg-white border rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">{documents.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Documents</p>
                  </div>
                </div>

                {/* TABS */}
                <div className="flex gap-2 border-b border-gray-200">
                  {["sessions", "progress", "documents"].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors ${activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                      {tab}
                    </button>
                  ))}
                </div>

                {/* SESSIONS */}
                {activeTab === "sessions" && (
                  <div className="space-y-3">
                    {sessions.length === 0 && <p className="text-gray-400 text-sm">No sessions yet.</p>}
                    {sessions.map(s => (
                      <div key={s.id} className="bg-white border border-gray-100 rounded-xl p-4">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium text-gray-800">
                            {s.date ? new Date(s.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : new Date(s.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {s.status}
                          </span>
                        </div>
                        {s.programs_targeted && <p className="text-sm text-gray-600 mt-2"><span className="font-medium">Programs:</span> {s.programs_targeted}</p>}
                        {s.notes && <p className="text-sm text-gray-500 mt-1 italic">{s.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* PROGRESS */}
                {activeTab === "progress" && (
                  <div className="space-y-4">
                    <div className="bg-white border rounded-xl p-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Attendance</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-3">
                          <div className="bg-green-500 h-3 rounded-full" style={{ width: `${attendanceRate}%` }} />
                        </div>
                        <span className="text-sm font-bold text-gray-700">{attendanceRate}%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{completed} of {sessions.length} sessions completed</p>
                    </div>

                    {progressData.length >= 2 && (
                      <div className="bg-white border rounded-xl p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Session Activity</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={progressData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="session" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="programs" stroke="#2563eb" strokeWidth={2} name="Programs" dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="behaviors" stroke="#dc2626" strokeWidth={2} name="Behaviors" dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}

                {/* DOCUMENTS */}
                {activeTab === "documents" && (
                  <div className="space-y-2">
                    {documents.length === 0 && <p className="text-gray-400 text-sm">No documents shared yet.</p>}
                    {documents.map(doc => (
                      <div key={doc.id} className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{doc.file_type ?? "Document"} · {new Date(doc.created_at).toLocaleDateString()}</p>
                        </div>
                        {doc.file_url && (
                          <button onClick={() => window.open(doc.file_url!, "_blank")}
                            className="text-xs px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50">
                            View
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* MESSAGE CLINIC */}
                <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Message Your Clinic</p>
                  {messageSent && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
                      Message sent! Your clinic will respond soon.
                    </div>
                  )}
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Ask a question or leave a note for your therapy team..."
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button onClick={handleSendMessage} disabled={sending || !message.trim()}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {sending ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
