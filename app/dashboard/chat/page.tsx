"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Client = { id: string; full_name: string };
type Message = {
  id: string;
  client_id?: string;
  user_id: string;
  message: string;
  sender_name: string | null;
  sender_role: string | null;
  created_at: string;
};
type StaffMember = { user_id: string; full_name: string; role: string };
type GroupChat = {
  id: string;
  name: string | null;
  created_by: string;
  created_at: string;
  members: StaffMember[];
};

const QUICK_MESSAGES = [
  "Session started",
  "Session ended",
  "Running 5 minutes late",
  "Client not home",
  "Need supervisor assistance",
  "Incident occurred",
];

const PRIVILEGED_ROLES = ["bcba", "admin", "clinical_director"];

// Fire-and-forget push notification to chat recipients. Never throws —
// a failed push should never block or roll back a sent message.
async function notifyChat(
  kind: "team" | "group",
  opts: { clientId?: string; groupId?: string },
  message: string
) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    fetch("/api/push/notify-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind, ...opts, message, url: "/dashboard/chat" }),
    }).catch(() => {});
  } catch {}
}

export default function ChatPage() {
  const [tab, setTab] = useState<"team" | "groups">("team");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // GROUPS
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);

  const isPrivileged = true; // -- GROUPS --

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedClient) return;
    const channel = supabase
      .channel(`chat-${selectedClient.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "client_team_messages", filter: `client_id=eq.${selectedClient.id}` },
        (payload: any) => {
          setMessages(prev => [...prev, payload.new as Message]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedGroup) return;
    const channel = supabase
      .channel(`group-chat-${selectedGroup.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_chat_messages", filter: `group_chat_id=eq.${selectedGroup.id}` },
        (payload: any) => {
          setMessages(prev => [...prev, payload.new as Message]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (tab === "groups" && companyId) loadGroups();
  }, [tab, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // -- GROUPS --

  async function loadStaffList() {
    const { data } = await supabase
      .from("company_users")
      .select("user_id, role, profiles(full_name)")
      .eq("company_id", companyId)
      .eq("status", "active");
    const staff: StaffMember[] = (data ?? [])
      .map((row: any) => ({ user_id: row.user_id, role: row.role, full_name: row.profiles?.full_name ?? "Unknown" }))
      .filter((s: StaffMember) => s.user_id !== userId);
    setStaffList(staff);
  }

  async function loadGroups() {
    const { data } = await supabase.from("group_chats").select("*").order("created_at", { ascending: false });
    const groupIds = (data ?? []).map((g: any) => g.id);
    let membersByGroup: Record<string, StaffMember[]> = {};
    if (groupIds.length > 0) {
      const { data: memberRows } = await supabase
        .from("group_chat_members")
        .select("group_chat_id, user_id, profiles(full_name)")
        .in("group_chat_id", groupIds);
      (memberRows ?? []).forEach((m: any) => {
        if (!membersByGroup[m.group_chat_id]) membersByGroup[m.group_chat_id] = [];
        membersByGroup[m.group_chat_id].push({ user_id: m.user_id, full_name: m.profiles?.full_name?? "Unknown", role: "" });
      });
    }
    const built: GroupChat[] = (data ?? []).map((g: any) => ({
      id: g.id, name: g.name, created_by: g.created_by, created_at: g.created_at,
      members: membersByGroup[g.id] ?? [],
    }));
    setGroups(built);
  }

  function groupLabel(group: GroupChat) {
    if (group.name) return group.name;
    const others = group.members.filter(m => m.user_id !== userId).map(m => m.full_name);
    if (others.length === 0) return "Group Chat";
    if (others.length <= 3) return others.join(", ");
    return `${others.slice(0, 3).join(", ")} +${others.length - 3}`;
  }

  async function openCreateGroup() {
    await loadStaffList();
    setNewGroupName("");
    setSelectedMemberIds([]);
    setShowCreateGroup(true);
  }

  async function createGroup() {
    if (selectedMemberIds.length === 0) { alert("Select at least one person to add."); return; }
    setCreatingGroup(true);
    const { data: group, error } = await supabase.from("group_chats").insert({
      company_id: companyId, name: newGroupName.trim() || null, created_by: userId,
    }).select().single();
    if (error || !group) { alert(error?.message ?? "Could not create group."); setCreatingGroup(false); return; }
    const memberRows = [userId, ...selectedMemberIds].map(uid => ({ group_chat_id: group.id, user_id: uid, added_by: userId }));
    await supabase.from("group_chat_members").insert(memberRows);
    setCreatingGroup(false);
    setShowCreateGroup(false);
    await loadGroups();
  }

  async function selectGroup(group: GroupChat) {
    setSelectedGroup(group);
    setMessages([]);
    const { data } = await supabase.from("group_chat_messages").select("*").eq("group_chat_id", group.id).order("created_at", { ascending: true }).limit(100);
    setMessages(data ?? []);
  }

  async function openManageMembers() {
    await loadStaffList();
    setShowManageMembers(true);
  }

  async function addMemberToGroup(staffMember: StaffMember) {
    if (!selectedGroup) return;
    await supabase.from("group_chat_members").insert({ group_chat_id: selectedGroup.id, user_id: staffMember.user_id, added_by: userId });
    const updated = { ...selectedGroup, members: [...selectedGroup.members, staffMember] };
    setSelectedGroup(updated);
    setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
  }

  async function removeMemberFromGroup(memberUserId: string) {
    if (!selectedGroup) return;
    if (!confirm("Remove this person from the group?")) return;
    await supabase.from("group_chat_members").delete().eq("group_chat_id", selectedGroup.id).eq("user_id", memberUserId);
    const updated = { ...selectedGroup, members: selectedGroup.members.filter(m => m.user_id !== memberUserId) };
    setSelectedGroup(updated);
    setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
  }

  async function handleSend(msg?: string) {
    const text = msg ?? input.trim();
    if (!text) return;
    if (tab === "team" && !selectedClient) return;
    if (tab === "groups" && !selectedGroup) return;
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
    setInput("");

    if (tab === "team" && selectedClient) {
      const { error } = await supabase.from("client_team_messages").insert({
        client_id: selectedClient.id, user_id: userId, message: text, sender_name: userName, sender_role: userRole,
      });
      if (error) setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      else notifyChat("team", { clientId: selectedClient.id }, text);
    } else if (tab === "groups" && selectedGroup) {
      const { error } = await supabase.from("group_chat_messages").insert({
        group_chat_id: selectedGroup.id, user_id: userId, message: text, sender_name: userName, sender_role: userRole,
      });
      if (error) setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      else notifyChat("group", { groupId: selectedGroup.id }, text);
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

  const availableToAdd = staffList.filter(s => !selectedGroup?.members.some(m => m.user_id === s.user_id));
  const showingChat = (tab === "team" && selectedClient) || (tab === "groups" && selectedGroup);

  return (
    <div className="space-y-4">
      <PageHeader title="Chat" />

      {/* TAB TOGGLE */}
      <div className="flex gap-2 border-b border-gray-100 pb-1">
        {(["team", "groups"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setSelectedClient(null); setSelectedGroup(null); setMessages([]); }}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${tab === t ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}>
            {t === "team" ? "Team Chat" : "Groups"}
          </button>
        ))}
      </div>

      {/* TEAM - client list */}
      {tab === "team" && !selectedClient && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Select a client to view the team chat for that client.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {clients.map((client) => (
              <button key={client.id} onClick={() => selectClient(client)}
                className="bg-white border border-gray-100 hover:border-blue-300 rounded-xl p-4 text-left transition-all flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-centertext-white font-bold shrink-0">
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
      )}

      {/* GROUPS - list */}
      {tab === "groups" && !selectedGroup && (
        <div className="space-y-3">
          {isPrivileged && (
            <button onClick={openCreateGroup} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm">
              + New Group
            </button>
          )}
          {groups.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-gray-500 font-medium">No groups yet</p>
              <p className="text-gray-400 text-sm">{isPrivileged ? "Click + New Group to create one." : "Ask a BCBA or admin to add you to one."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {groups.map(g => (
                <button key={g.id} onClick={() => selectGroup(g)}
                  className="bg-white border border-gray-100 hover:border-purple-300 rounded-xl p-4text-left transition-all flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold shrink-0">👥</div>
                  <div>
                    <p className="font-semibold text-gray-800">{groupLabel(g)}</p>
                    <p className="text-xs text-gray-400">{g.members.length} member{g.members.length!== 1 ? "s" : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CHAT VIEW */}
      {showingChat && (
        <div className="flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { setSelectedClient(null); setSelectedGroup(null); setMessages([]); }} className="text-blue-500 hover:underline text-sm">
                Back
              </button>
              <h2 className="font-bold text-gray-800">
                {tab === "team" ? `${selectedClient?.full_name} - Team Chat` : groupLabel(selectedGroup!)}
              </h2>
            </div>
            {tab === "groups" && isPrivileged && (
              <button onClick={openManageMembers} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-600 text-white">
                👥 Manage Members
              </button>
            )}
          </div>

          {tab === "team" && (
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_MESSAGES.map((msg) => (
                <button key={msg} onClick={() => handleSend(msg)}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 rounded-full border border-gray-200 transition-colors">
                  {msg}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3 mb-3">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <p className="text-3xl mb-2">💬</p>
                <p className="text-gray-500 font-medium">No messages yet</p>
                <p className="text-gray-400 text-sm">Start the conversation</p>
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
                        {msg.sender_name ?? "Team"} - {msg.sender_role?.toUpperCase()}
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
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={tab === "team" ? "Message the team..." : "Message the group..."}
              className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <Button onClick={() => handleSend()} loading={sending} disabled={!input.trim()}>
              Send
            </Button>
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <p className="text-xl font-bold text-gray-900 mb-1">New Group</p>
            <p className="text-sm text-gray-500 mb-4">Name it (optional) and select who&apos;s in it</p>

            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Group Name (optional)</label>
            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. IEP Team - Jordan S."
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm mb-4" />

            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Add Members</label>
            <div className="max-h-64 overflow-y-auto mb-4 border rounded-lg divide-y">
              {staffList.length === 0 ? (
                <p className="text-center text-gray-400 py-5">No other staff found.</p>
              ) : staffList.map(s => {
                const checked = selectedMemberIds.includes(s.user_id);
                return (
                  <button key={s.user_id} onClick={() => setSelectedMemberIds(prev => checked ? prev.filter(id => id !== s.user_id) : [...prev, s.user_id])}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${roleBg(s.role)}`}>{s.full_name.charAt(0)}</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{s.full_name}</p>
                      <p className="text-xs text-gray-400">{s.role?.toUpperCase()}</p>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                      {checked && <span className="text-white text-xs font-bold">X</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <Button onClick={createGroup} loading={creatingGroup} disabled={selectedMemberIds.length === 0} className="w-full">
              Create Group ({selectedMemberIds.length} selected)
            </Button>
            <button onClick={() => setShowCreateGroup(false)} className="w-full text-center py-2 mt-1 text-gray-500 text-sm font-medium">Cancel</button>
          </div>
        </div>
      )}

      {/* MANAGE MEMBERS MODAL */}
      {showManageMembers && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <p className="text-xl font-bold text-gray-900 mb-4">Manage Members</p>

            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Current Members({selectedGroup.members.length})</label>
            <div className="mb-5 border rounded-lg divide-y">
              {selectedGroup.members.map(m => (
                <div key={m.user_id} className="flex items-center gap-3 p-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-centertext-white font-bold text-xs">{m.full_name.charAt(0)}</div>
                  <span className="flex-1 text-sm font-semibold text-gray-900">{m.full_name}{m.user_id === userId ? " (you)" : ""}</span>
                  {m.user_id !== userId && (
                    <button onClick={() => removeMemberFromGroup(m.user_id)} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-600">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Add Someone</label>
            <div className="border rounded-lg divide-y mb-4">
              {availableToAdd.length === 0 ? (
                <p className="text-sm text-gray-400 py-3 text-center">Everyone is already in this group.</p>
              ) : availableToAdd.map(s => (
                <button key={s.user_id} onClick={() => addMemberToGroup(s)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-whitefont-bold text-xs ${roleBg(s.role)}`}>{s.full_name.charAt(0)}</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{s.full_name}</p>
                    <p className="text-xs text-gray-400">{s.role?.toUpperCase()}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600">+ Add</span>
                </button>
              ))}
            </div>

            <button onClick={() => setShowManageMembers(false)} className="w-full text-center py-2.5 rounded-lg border border-gray-200 text-gray-600 font-medium text-sm">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
