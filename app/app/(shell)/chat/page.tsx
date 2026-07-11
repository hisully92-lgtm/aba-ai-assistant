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
type StaffMember = { user_id: string; full_name: string; role: string };
type GroupChat = {
  id: string;
  name: string | null;
  created_by: string;
  created_at: string;
  members: StaffMember[];
};

type ChatMode = "team" | "students" | "supervisors" | "groups";

const QUICK_MESSAGES = [
  "Question for supervisor",
  "Completed supervision hours",
  "Need MVF signed",
  "Available for session",
  "Submitted hours for review",
];

const PRIVILEGED_ROLES = ["bcba", "admin", "clinical_director"];

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

  // GROUPS
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);

  const isPrivileged = true; // All roles can create and manage groups

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === "team" && selectedClient) {
      const channel = supabase.channel(`chat-${selectedClient.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "client_team_messages", filter: `client_id=eq.${selectedClient.id}` },
          (payload: any) => { setMessages(prev => [...prev, payload.new as Message]); setTimeout(scrollToEnd, 100); })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
    if ((mode === "students" || mode === "supervisors") && companyId) {
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
    if (mode === "groups" && selectedGroup) {
      const ch = supabase.channel(`group-chat-${selectedGroup.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_chat_messages", filter: `group_chat_id=eq.${selectedGroup.id}` },
          (payload: any) => { setMessages(prev => [...prev, payload.new as Message]); setTimeout(scrollToEnd, 100); })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [selectedClient, selectedGroup, mode, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ((mode === "students" || mode === "supervisors") && companyId) loadStudentMessages();
    if (mode === "groups" && companyId) loadGroups();
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

  // â”€â”€ GROUPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const { data } = await supabase
      .from("group_chats")
      .select("*, group_chat_members(user_id, profiles(full_name), role:user_id)")
      .order("created_at", { ascending: false });

    // fetch member profiles+roles separately for reliability across schema variations
    const groupIds = (data ?? []).map((g: any) => g.id);
    let membersByGroup: Record<string, StaffMember[]> = {};
    if (groupIds.length > 0) {
      const { data: memberRows } = await supabase
        .from("group_chat_members")
        .select("group_chat_id, user_id, profiles(full_name)")
        .in("group_chat_id", groupIds);
      (memberRows ?? []).forEach((m: any) => {
        if (!membersByGroup[m.group_chat_id]) membersByGroup[m.group_chat_id] = [];
        membersByGroup[m.group_chat_id].push({ user_id: m.user_id, full_name: m.profiles?.full_name ?? "Unknown", role: "" });
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

    const memberRows = [userId, ...selectedMemberIds].map(uid => ({
      group_chat_id: group.id, user_id: uid, added_by: userId,
    }));
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
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
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
    } else if (mode === "groups" && selectedGroup) {
      const { error } = await supabase.from("group_chat_messages").insert({
        group_chat_id: selectedGroup.id, user_id: userId, message: text, sender_name: userName, sender_role: userRole,
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

  const availableToAdd = staffList.filter(s => !selectedGroup?.members.some(m => m.user_id === s.user_id));

  return (
    <AppShell title="Chat">
      <div className="flex flex-col h-full">
        {/* MODE TABS */}
        <div className="flex bg-white border-b border-gray-100 overflow-x-auto">
          {([
            { key: "team", label: "Team" },
            { key: "students", label: "Students" },
            { key: "supervisors", label: "Supervisors" },
            { key: "groups", label: "Groups" },
          ] as { key: ChatMode; label: string }[]).map(tab => (
            <button key={tab.key} onClick={() => { setMode(tab.key); setSelectedClient(null); setSelectedGroup(null); setMessages([]); }}
              className="flex-1 py-3 text-center border-b-2 whitespace-nowrap px-2" style={{ borderColor: mode === tab.key ? "#2563eb" : "transparent" }}>
              <span className="text-[13px] font-semibold" style={{ color: mode === tab.key ? "#2563eb" : "#6b7280" }}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TEAM CHAT â€” client selector */}
        {mode === "team" && !selectedClient && (
          <div className="p-4">
            <p className="text-sm text-gray-500 mb-4 font-medium">Select a client to view team chat</p>
            {clients.map(c => (
              <button key={c.id} onClick={() => selectClient(c)} className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 mb-2 shadow-sm text-left">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: "#2563eb" }}>{c.full_name.charAt(0)}</div>
                <span className="flex-1 text-[15px] font-semibold text-gray-900">{c.full_name}</span>
                <span className="text-xl text-gray-300">â€º</span>
              </button>
            ))}
          </div>
        )}

        {/* GROUPS â€” list */}
        {mode === "groups" && !selectedGroup && (
          <div className="p-4">
            {isPrivileged && (
              <button onClick={openCreateGroup} className="w-full text-white font-bold py-3 rounded-xl mb-4" style={{ backgroundColor: "#2563eb" }}>
                + New Group
              </button>
            )}
            {groups.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <p className="text-4xl mb-3">ðŸ‘¥</p>
                <p className="text-sm text-gray-400 text-center">No groups yet.{isPrivileged ? " Tap + New Group to create one." : " Ask a BCBA or admin to add you to one."}</p>
              </div>
            ) : groups.map(g => (
              <button key={g.id} onClick={() => selectGroup(g)} className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 mb-2 shadow-sm text-left">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: "#7c3aed" }}>ðŸ‘¥</div>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-gray-900">{groupLabel(g)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{g.members.length} member{g.members.length !== 1 ? "s" : ""}</p>
                </div>
                <span className="text-xl text-gray-300">â€º</span>
              </button>
            ))}
          </div>
        )}

        {/* CHAT VIEW (team client / students / supervisors / group) */}
        {((mode === "team" && selectedClient) || mode === "students" || mode === "supervisors" || (mode === "groups" && selectedGroup)) && (
          <>
            {mode === "team" && selectedClient && (
              <button onClick={() => { setSelectedClient(null); setMessages([]); }} className="w-full text-left px-4 py-2.5" style={{ backgroundColor: "#1a2234" }}>
                <span className="text-white text-[15px] font-semibold">â€¹ {selectedClient.full_name}</span>
              </button>
            )}

            {mode === "groups" && selectedGroup && (
              <div className="flex items-center px-4 py-2.5" style={{ backgroundColor: "#1a2234" }}>
                <button onClick={() => { setSelectedGroup(null); setMessages([]); }} className="text-left flex-1">
                  <span className="text-white text-[15px] font-semibold">â€¹ {groupLabel(selectedGroup)}</span>
                </button>
                {isPrivileged && (
                  <button onClick={openManageMembers} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#2563eb", color: "#fff" }}>
                    ðŸ‘¥ Manage
                  </button>
                )}
              </div>
            )}

            {(mode === "students" || mode === "supervisors") && (
              <div className="px-4 py-2 border-b" style={{ backgroundColor: "#eff6ff", borderColor: "#dbeafe" }}>
                <p className="text-xs" style={{ color: "#3b82f6" }}>
                  {mode === "students" ? "ðŸŽ“ Chat with other student analysts" : "ðŸ‘©â€ðŸ« Chat with BCBAs, supervisors, and directors"}
                </p>
              </div>
            )}

            {(mode === "students" || mode === "supervisors") && (
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
                  <p className="text-4xl mb-3">ðŸ’¬</p>
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
                        {!isMe && <p className="text-[11px] font-bold mb-1" style={{ color: roleColor(item.sender_role) }}>{item.sender_name ?? "Unknown"} Â· {item.sender_role?.toUpperCase()}</p>}
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
                placeholder={mode === "team" ? "Message the team..." : mode === "students" ? "Message students..." : mode === "groups" ? "Message the group..." : "Message supervisors..."}
                className="flex-1 border border-gray-300 rounded-2xl px-4 py-2.5 text-sm bg-gray-50 resize-none" style={{ maxHeight: 100 }} rows={1} />
              <button onClick={() => handleSend()} disabled={!messageText.trim() || sending}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0 disabled:opacity-50"
                style={{ backgroundColor: !messageText.trim() ? "#93c5fd" : "#2563eb" }}>
                â†‘
              </button>
            </div>
          </>
        )}
      </div>

      {/* CREATE GROUP MODAL */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full bg-white rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto">
            <p className="text-xl font-extrabold text-gray-900 mb-1">New Group</p>
            <p className="text-[13px] text-gray-500 mb-4">Name it (optional) and select who&apos;s in it</p>

            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Group Name (optional)</p>
            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. IEP Team - Jordan S."
              className="w-full border border-gray-300 rounded-lg px-3.5 py-3 text-sm mb-4" />

            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Add Members</p>
            <div className="max-h-64 overflow-y-auto mb-4">
              {staffList.length === 0 ? (
                <p className="text-center text-gray-400 py-5">No other staff found.</p>
              ) : staffList.map(s => {
                const checked = selectedMemberIds.includes(s.user_id);
                return (
                  <button key={s.user_id} onClick={() => setSelectedMemberIds(prev => checked ? prev.filter(id => id !== s.user_id) : [...prev, s.user_id])}
                    className="w-full flex items-center gap-3 py-3 border-b border-gray-100 text-left">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: roleColor(s.role) }}>{s.full_name.charAt(0)}</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{s.full_name}</p>
                      <p className="text-xs text-gray-400">{s.role?.toUpperCase()}</p>
                    </div>
                    <div className="w-6 h-6 rounded-md border-2 flex items-center justify-center" style={checked ? { backgroundColor: "#2563eb", borderColor: "#2563eb" } : { borderColor: "#d1d5db" }}>
                      {checked && <span className="text-white text-sm font-bold">âœ“</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <button onClick={createGroup} disabled={creatingGroup || selectedMemberIds.length === 0} className="w-full text-white font-bold py-3.5 rounded-xl disabled:opacity-40" style={{ backgroundColor: "#2563eb" }}>
              {creatingGroup ? "..." : `Create Group (${selectedMemberIds.length} selected)`}
            </button>
            <button onClick={() => setShowCreateGroup(false)} className="w-full text-center py-3 mt-1 text-gray-500 font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {/* MANAGE MEMBERS MODAL */}
      {showManageMembers && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full bg-white rounded-t-3xl p-6 pb-10 max-h-[85vh] overflow-y-auto">
            <p className="text-xl font-extrabold text-gray-900 mb-4">Manage Members</p>

            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Current Members ({selectedGroup.members.length})</p>
            <div className="mb-5">
              {selectedGroup.members.map(m => (
                <div key={m.user_id} className="flex items-center gap-3 py-2.5 border-b border-gray-100">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: "#2563eb" }}>{m.full_name.charAt(0)}</div>
                  <span className="flex-1 text-sm font-semibold text-gray-900">{m.full_name}{m.user_id === userId ? " (you)" : ""}</span>
                  {m.user_id !== userId && (
                    <button onClick={() => removeMemberFromGroup(m.user_id)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Add Someone</p>
            {availableToAdd.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">Everyone is already in this group.</p>
            ) : availableToAdd.map(s => (
              <button key={s.user_id} onClick={() => addMemberToGroup(s)} className="w-full flex items-center gap-3 py-2.5 border-b border-gray-100 text-left">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: roleColor(s.role) }}>{s.full_name.charAt(0)}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{s.full_name}</p>
                  <p className="text-xs text-gray-400">{s.role?.toUpperCase()}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>+ Add</span>
              </button>
            ))}

            <button onClick={() => setShowManageMembers(false)} className="w-full text-center py-3.5 mt-4 rounded-xl border border-gray-200 text-gray-500 font-semibold">Done</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
