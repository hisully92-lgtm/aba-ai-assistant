"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Client = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  company_id: string;
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
type AssignedStaff = {
  user_id: string;
  full_name: string;
};
type GroupChat = {
  id: string;
  name: string | null;
  members: AssignedStaff[];
};
type GroupMessage = {
  id: string;
  message: string;
  sender_name: string;
  user_id: string;
  created_at: string;
};

// Fire-and-forget push notification to group chat recipients. Never throws —
// a failed push should never block or roll back a sent message.
async function notifyChat(groupId: string, message: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    fetch("/api/push/notify-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind: "group", groupId, message, url: "/parent/dashboard" }),
    }).catch(() => {});
  } catch {}
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState("");
  const [userId, setUserId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<"sessions" | "progress" | "documents" | "chat">("sessions");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [assignedStaff, setAssignedStaff] = useState<AssignedStaff[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupMessageText, setGroupMessageText] = useState("");
  const [sendingGroupMessage, setSendingGroupMessage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "chat" && selectedClient) {
      loadGroups();
      loadAssignedStaff();
    }
  }, [activeTab, selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groupMessages]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) { router.push("/parent"); return; }
    setUserId(user.id);

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

    const { data: clientData } = await supabase
      .from("clients")
      .select("id, full_name, date_of_birth, company_id")
      .eq("parent_user_id", user.id)
      .order("full_name");
    const clientList = (clientData ?? []) as Client[];
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
    setSelectedGroup(null);
    setGroups([]);
  }

  async function loadAssignedStaff() {
    if (!selectedClient) return;
    const { data } = await supabase
      .from("assignments")
      .select("rbt_id, supervisor_id")
      .eq("client_id", selectedClient.id);

    const staffIds = Array.from(new Set(
      (data ?? []).flatMap((a: { rbt_id: string | null; supervisor_id: string | null }) => [a.rbt_id, a.supervisor_id].filter(Boolean))
    )) as string[];

    if (staffIds.length === 0) { setAssignedStaff([]); return; }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", staffIds);

    setAssignedStaff((profiles ?? []).map((p: { id: string; full_name: string | null }) => ({ user_id: p.id, full_name: p.full_name ?? "Unknown" })));
  }

  async function loadGroups() {
    if (!selectedClient) return;
    const { data } = await supabase
      .from("group_chats")
      .select("*")
      .eq("company_id", selectedClient.company_id)
      .order("created_at", { ascending: false });

    const groupIds = (data ?? []).map((g: { id: string }) => g.id);
    let membersByGroup: Record<string, AssignedStaff[]> = {};

    if (groupIds.length > 0) {
      const { data: memberRows } = await supabase
        .from("group_chat_members")
        .select("group_chat_id, user_id, profiles(full_name)")
        .in("group_chat_id", groupIds);

      (memberRows ?? []).forEach((m: any) => {
        if (!membersByGroup[m.group_chat_id]) membersByGroup[m.group_chat_id] = [];
        membersByGroup[m.group_chat_id].push({ user_id: m.user_id, full_name: m.profiles?.full_name?? "Unknown" });
      });
    }

    const built: GroupChat[] = (data ?? [])
      .map((g: { id: string; name: string | null }) => ({
        id: g.id,
        name: g.name,
        members: membersByGroup[g.id] ?? [],
      }))
      .filter((g: GroupChat) => g.members.some((m) => m.user_id === userId));

    setGroups(built);
  }

  function openCreateGroup() {
    setNewGroupName("");
    setSelectedMemberIds([]);
    setShowCreateGroup(true);
  }

  async function createGroup() {
    if (!selectedClient || selectedMemberIds.length === 0) { alert("Select at least one staff member to add."); return; }
    setCreatingGroup(true);

    const { data: group, error } = await supabase.from("group_chats").insert({
      company_id: selectedClient.company_id,
      name: newGroupName.trim() || null,
      created_by: userId,
    }).select().single();

    if (error || !group) { setCreatingGroup(false); return; }

    const memberRows = [userId, ...selectedMemberIds].map((uid) => ({
      group_chat_id: group.id,
      user_id: uid,
    }));
    await supabase.from("group_chat_members").insert(memberRows);

    setCreatingGroup(false);
    setShowCreateGroup(false);
    await loadGroups();
  }

  async function selectGroup(group: GroupChat) {
    setSelectedGroup(group);
    const { data } = await supabase
      .from("group_chat_messages")
      .select("id, message, sender_name, user_id, created_at")
      .eq("group_chat_id", group.id)
      .order("created_at", { ascending: true });
    setGroupMessages(data ?? []);
  }

  async function sendGroupMessage() {
    const text = groupMessageText.trim();
    if (!text || !selectedGroup) return;
    setSendingGroupMessage(true);

    const optimistic: GroupMessage = {
      id: "temp-" + Date.now(),
      message: text,
      sender_name: parentName,
      user_id: userId,
      created_at: new Date().toISOString(),
    };
    setGroupMessages((prev) => [...prev, optimistic]);
    setGroupMessageText("");

    const { error } = await supabase.from("group_chat_messages").insert({
      group_chat_id: selectedGroup.id,
      user_id: userId,
      message: text,
      sender_name: parentName,
      sender_role: "parent",
    });

    if (error) {
      setGroupMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } else {
      notifyChat(selectedGroup.id, text);
    }
    setSendingGroupMessage(false);
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

        {clients.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl bg-white">
            <p className="text-4xl mb-3">Note</p>
            <p className="font-semibold text-gray-700">No clients linked to your account</p>
            <p className="text-sm text-gray-400 mt-1">Contact your clinic to link your child&apos;sprofile.</p>
          </div>
        ) : (
          <>
            {clients.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {clients.map(c => (
                  <button key={c.id} onClick={() => loadClientData(c)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedClient?.id === c.id ? "bg-blue-600 text-white" : "bg-white border border-gray-200text-gray-600 hover:border-blue-300"}`}>
                    {c.full_name}
                  </button>
                ))}
              </div>
            )}

            {selectedClient && (
              <>
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

                <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
                  {["sessions", "progress", "documents", "chat"].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 capitalize whitespace-nowrap transition-colors ${activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                      {tab}
                    </button>
                  ))}
                </div>

                {activeTab === "sessions" && (
                  <div className="space-y-3">
                    {sessions.length === 0 && <p className="text-gray-400 text-sm">No sessions yet.</p>}
                    {sessions.map(s => (
                      <div key={s.id} className="bg-white border border-gray-100 rounded-xl p-4">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium text-gray-800">
                            {s.date ? new Date(s.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : new Date(s.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status=== "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {s.status}
                          </span>
                        </div>
                        {s.programs_targeted && <p className="text-sm text-gray-600 mt-2"><span className="font-medium">Programs:</span> {s.programs_targeted}</p>}
                        {s.notes && <p className="text-sm text-gray-500 mt-1 italic">{s.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}

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

                {activeTab === "documents" && (
                  <div className="space-y-2">
                    {documents.length === 0 && <p className="text-gray-400 text-sm">No documents shared yet.</p>}
                    {documents.map(doc => (
                      <div key={doc.id} className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{doc.file_type ?? "Document"}- {new Date(doc.created_at).toLocaleDateString()}</p>
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

                {activeTab === "chat" && (
                  <div className="space-y-3">
                    {!selectedGroup ? (
                      <>
                        <button onClick={openCreateGroup}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm">
                          + New Group
                        </button>
                        {groups.length === 0 ? (
                          <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl bg-white">
                            <p className="text-gray-500 font-medium">No groups yet</p>
                            <p className="text-gray-400 text-sm mt-1">Create a group to message your child&apos;s care team.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {groups.map((g) => (
                              <button key={g.id} onClick={() => selectGroup(g)}
                                className="w-full bg-white border border-gray-100 hover:border-blue-300 rounded-xl p-4 text-left transition-all">
                                <p className="font-semibold text-gray-800 text-sm">{g.name || "Unnamed Group"}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{g.members.length} members</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-white border border-gray-100 rounded-xl flex flex-col" style={{ height: "500px" }}>
                        <div className="flex items-center justify-between border-b border-gray-100 p-3">
                          <button onClick={() => setSelectedGroup(null)} className="text-sm text-blue-600 font-medium">
                            Back
                          </button>
                          <p className="font-semibold text-gray-800 text-sm">{selectedGroup.name ||"Unnamed Group"}</p>
                          <div style={{ width: 40 }} />
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                          {groupMessages.map((m) => (
                            <div key={m.id} className={`flex ${m.user_id === userId ? "justify-end": "justify-start"}`}>
                              <div className={`max-w-[75%] rounded-xl px-3 py-2 ${m.user_id === userId ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                                {m.user_id !== userId && <p className="text-xs font-semibold mb-0.5">{m.sender_name}</p>}
                                <p className="text-sm">{m.message}</p>
                              </div>
                            </div>
                          ))}
                          <div ref={bottomRef} />
                        </div>
                        <div className="border-t border-gray-100 p-3 flex gap-2">
                          <input
                            type="text"
                            value={groupMessageText}
                            onChange={(e) => setGroupMessageText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendGroupMessage()}
                            placeholder="Type a message..."
                            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <button onClick={sendGroupMessage} disabled={sendingGroupMessage || !groupMessageText.trim()}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                            Send
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab !== "chat" && (
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
                )}
              </>
            )}
          </>
        )}
      </div>

      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <p className="font-bold text-gray-900 mb-4">New Group</p>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Group Name (optional)</label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Sam's Care Team"
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <p className="text-sm font-medium text-gray-700 mb-2">Add Staff (assigned to {selectedClient?.full_name})</p>
            {assignedStaff.length === 0 ? (
              <p className="text-xs text-gray-400 mb-4">No staff are currently assigned to this child.</p>
            ) : (
              <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
                {assignedStaff.map((s) => (
                  <label key={s.user_id} className="flex items-center gap-3 cursor-pointer border border-gray-100 rounded-lg p-2">
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(s.user_id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedMemberIds((prev) => [...prev, s.user_id]);
                        else setSelectedMemberIds((prev) => prev.filter((id) => id !== s.user_id));
                      }}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">{s.full_name}</span>
                  </label>
                ))}
              </div>
            )}
            <button onClick={createGroup} disabled={creatingGroup || selectedMemberIds.length === 0}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
              {creatingGroup ? "Creating..." : "Create Group (" + selectedMemberIds.length + " selected)"}
            </button>
            <button onClick={() => setShowCreateGroup(false)} className="w-full text-center py-2 mt-1 text-gray-500 text-sm font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
