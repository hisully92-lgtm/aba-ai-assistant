import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Modal
} from "react-native";
import { supabase } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";

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

export default function ChatScreen() {
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
  const flatListRef = useRef<FlatList>(null);

  // GROUPS
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);

  const isPrivileged = PRIVILEGED_ROLES.includes(userRole);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === "team" && !selectedClient) return;
    if (mode === "team" && selectedClient) {
      const channel = supabase.channel(`chat-${selectedClient.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "client_team_messages", filter: `client_id=eq.${selectedClient.id}` },
          payload => { setMessages(prev => [...prev, payload.new as Message]); setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100); })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
    if ((mode === "students" || mode === "supervisors") && companyId) {
      const ch = supabase.channel(`student-chat-${companyId}-${mode}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "student_chat_messages", filter: `company_id=eq.${companyId}` },
          (payload: any) => {
            if (payload.new.channel === mode) {
              setMessages(prev => [...prev, payload.new as Message]);
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            }
          })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
    if (mode === "groups" && selectedGroup) {
      const ch = supabase.channel(`group-chat-${selectedGroup.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_chat_messages", filter: `group_chat_id=eq.${selectedGroup.id}` },
          (payload: any) => { setMessages(prev => [...prev, payload.new as Message]); setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100); })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [selectedClient, selectedGroup, mode, companyId]);

  useEffect(() => {
    if ((mode === "students" || mode === "supervisors") && companyId) loadStudentMessages();
    if (mode === "groups" && companyId) loadGroups();
  }, [mode, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }

  async function selectClient(client: Client) {
    setSelectedClient(client);
    setMessages([]);
    const { data } = await supabase.from("client_team_messages").select("*").eq("client_id", client.id).order("created_at", { ascending: true }).limit(100);
    setMessages(data ?? []);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }

  // ── GROUPS ──────────────────────────────────────────────

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
    if (selectedMemberIds.length === 0) { Alert.alert("Select at least one person to add."); return; }
    setCreatingGroup(true);
    const { data: group, error } = await supabase.from("group_chats").insert({
      company_id: companyId, name: newGroupName.trim() || null, created_by: userId,
    }).select().single();
    if (error || !group) { Alert.alert("Error", error?.message ?? "Could not create group."); setCreatingGroup(false); return; }
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
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
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

  function removeMemberFromGroup(memberUserId: string) {
    if (!selectedGroup) return;
    Alert.alert("Remove member", "Remove this person from the group?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          await supabase.from("group_chat_members").delete().eq("group_chat_id", selectedGroup.id).eq("user_id", memberUserId);
          const updated = { ...selectedGroup, members: selectedGroup.members.filter(m => m.user_id !== memberUserId) };
          setSelectedGroup(updated);
          setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
        }
      }
    ]);
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
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    if (mode === "team" && selectedClient) {
      const { error } = await supabase.from("client_team_messages").insert({
        client_id: selectedClient.id,
        user_id: userId,
        message: text,
        sender_name: userName,
        sender_role: userRole,
      });
      if (error) { setMessages(prev => prev.filter(m => m.id !== optimistic.id)); Alert.alert("Error", error.message); }
    } else if (mode === "groups" && selectedGroup) {
      const { error } = await supabase.from("group_chat_messages").insert({
        group_chat_id: selectedGroup.id, user_id: userId, message: text, sender_name: userName, sender_role: userRole,
      });
      if (error) { setMessages(prev => prev.filter(m => m.id !== optimistic.id)); Alert.alert("Error", error.message); }
    } else {
      const { error } = await supabase.from("student_chat_messages").insert({
        company_id: companyId,
        user_id: userId,
        message: text,
        sender_name: userName,
        sender_role: userRole,
        channel: mode,
      });
      if (error) { setMessages(prev => prev.filter(m => m.id !== optimistic.id)); Alert.alert("Error", error.message); }
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

  if (loading) return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>;

  const availableToAdd = staffList.filter(s => !selectedGroup?.members.some(m => m.user_id === s.user_id));
  const showingChat = (mode === "team" && selectedClient) || mode === "students" || mode === "supervisors" || (mode === "groups" && selectedGroup);

  return (
    <View style={styles.container}>
      <AppHeader title="Chat" />

      {/* MODE TABS */}
      <View style={styles.tabBar}>
        {([
          { key: "team", label: "Team" },
          { key: "students", label: "Students" },
          { key: "supervisors", label: "Supervisors" },
          { key: "groups", label: "Groups" },
        ] as { key: ChatMode; label: string }[]).map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.tab, mode === tab.key && styles.tabActive]}
            onPress={() => { setMode(tab.key); setSelectedClient(null); setSelectedGroup(null); setMessages([]); }}>
            <Text style={[styles.tabText, mode === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TEAM CHAT — client selector */}
      {mode === "team" && !selectedClient && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.selectLabel}>Select a client to view team chat</Text>
          {clients.map(c => (
            <TouchableOpacity key={c.id} style={styles.clientRow} onPress={() => selectClient(c)}>
              <View style={styles.clientAvatar}><Text style={styles.clientAvatarText}>{c.full_name.charAt(0)}</Text></View>
              <Text style={styles.clientName}>{c.full_name}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* GROUPS — list */}
      {mode === "groups" && !selectedGroup && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {isPrivileged && (
            <TouchableOpacity style={styles.newGroupBtn} onPress={openCreateGroup}>
              <Text style={styles.newGroupBtnText}>+ New Group</Text>
            </TouchableOpacity>
          )}
          {groups.length === 0 ? (
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatEmoji}>👥</Text>
              <Text style={styles.emptyChatText}>
                No groups yet. {isPrivileged ? "Tap + New Group to create one." : "Ask a BCBA or admin to add you to one."}
              </Text>
            </View>
          ) : groups.map(g => (
            <TouchableOpacity key={g.id} style={styles.clientRow} onPress={() => selectGroup(g)}>
              <View style={[styles.clientAvatar, { backgroundColor: "#7c3aed" }]}><Text style={styles.clientAvatarText}>👥</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{groupLabel(g)}</Text>
                <Text style={styles.groupMemberCount}>{g.members.length} member{g.members.length !== 1 ? "s" : ""}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* CHAT VIEW */}
      {showingChat && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
          {mode === "team" && selectedClient && (
            <TouchableOpacity style={styles.backRow} onPress={() => { setSelectedClient(null); setMessages([]); }}>
              <Text style={styles.backRowText}>‹ {selectedClient.full_name}</Text>
            </TouchableOpacity>
          )}

          {mode === "groups" && selectedGroup && (
            <View style={styles.groupHeaderRow}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => { setSelectedGroup(null); setMessages([]); }}>
                <Text style={styles.backRowText}>‹ {groupLabel(selectedGroup)}</Text>
              </TouchableOpacity>
              {isPrivileged && (
                <TouchableOpacity style={styles.manageBtn} onPress={openManageMembers}>
                  <Text style={styles.manageBtnText}>👥 Manage</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {(mode === "students" || mode === "supervisors") && (
            <View style={styles.channelLabel}>
              <Text style={styles.channelLabelText}>
                {mode === "students" ? "🎓 Chat with other student analysts" : "👩‍🏫 Chat with BCBAs, supervisors, and directors"}
              </Text>
            </View>
          )}

          {(mode === "students" || mode === "supervisors") && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
              {QUICK_MESSAGES.map(msg => (
                <TouchableOpacity key={msg} style={styles.quickBtn} onPress={() => handleSend(msg)}>
                  <Text style={styles.quickBtnText}>{msg}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <FlatList ref={flatListRef} data={messages} keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatEmoji}>💬</Text>
                <Text style={styles.emptyChatText}>No messages yet. Start the conversation!</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe = item.user_id === userId;
              return (
                <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                  {!isMe && <View style={[styles.msgAvatar, { backgroundColor: roleColor(item.sender_role) }]}><Text style={styles.msgAvatarText}>{(item.sender_name ?? "?").charAt(0)}</Text></View>}
                  <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
                    {!isMe && <Text style={[styles.msgSender, { color: roleColor(item.sender_role) }]}>{item.sender_name ?? "Unknown"} · {item.sender_role?.toUpperCase()}</Text>}
                    <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.message}</Text>
                    <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.inputRow}>
            <TextInput style={styles.input} value={messageText} onChangeText={setMessageText}
              placeholder={mode === "team" ? "Message the team..." : mode === "students" ? "Message students..." : mode === "groups" ? "Message the group..." : "Message supervisors..."}
              multiline maxLength={500} />
            <TouchableOpacity style={[styles.sendBtn, !messageText.trim() && styles.sendBtnDisabled]}
              onPress={() => handleSend()} disabled={!messageText.trim() || sending}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>↑</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* CREATE GROUP MODAL */}
      <Modal visible={showCreateGroup} animationType="slide" transparent onRequestClose={() => setShowCreateGroup(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>New Group</Text>
            <Text style={styles.modalSub}>Name it (optional) and select who&apos;s in it</Text>

            <Text style={styles.fieldLabel}>Group Name (optional)</Text>
            <TextInput style={styles.textInput} value={newGroupName} onChangeText={setNewGroupName} placeholder="e.g. IEP Team - Jordan S." />

            <Text style={styles.fieldLabel}>Add Members</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {staffList.length === 0 ? (
                <Text style={styles.modalEmpty}>No other staff found.</Text>
              ) : staffList.map(s => {
                const checked = selectedMemberIds.includes(s.user_id);
                return (
                  <TouchableOpacity key={s.user_id} style={styles.staffRow}
                    onPress={() => setSelectedMemberIds(prev => checked ? prev.filter(id => id !== s.user_id) : [...prev, s.user_id])}>
                    <View style={[styles.staffAvatar, { backgroundColor: roleColor(s.role) }]}><Text style={styles.staffAvatarText}>{s.full_name.charAt(0)}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName}>{s.full_name}</Text>
                      <Text style={styles.staffRole}>{s.role?.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={[styles.primaryBtn, (creatingGroup || selectedMemberIds.length === 0) && { opacity: 0.4 }]}
              onPress={createGroup} disabled={creatingGroup || selectedMemberIds.length === 0}>
              {creatingGroup ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Group ({selectedMemberIds.length} selected)</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreateGroup(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MANAGE MEMBERS MODAL */}
      <Modal visible={showManageMembers} animationType="slide" transparent onRequestClose={() => setShowManageMembers(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>Manage Members</Text>

            {selectedGroup && (
              <>
                <Text style={styles.fieldLabel}>Current Members ({selectedGroup.members.length})</Text>
                <ScrollView style={{ maxHeight: 180, marginBottom: 16 }}>
                  {selectedGroup.members.map(m => (
                    <View key={m.user_id} style={styles.staffRow}>
                      <View style={[styles.staffAvatar, { backgroundColor: "#2563eb" }]}><Text style={styles.staffAvatarText}>{m.full_name.charAt(0)}</Text></View>
                      <Text style={[styles.staffName, { flex: 1 }]}>{m.full_name}{m.user_id === userId ? " (you)" : ""}</Text>
                      {m.user_id !== userId && (
                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeMemberFromGroup(m.user_id)}>
                          <Text style={styles.removeBtnText}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Add Someone</Text>
                <ScrollView style={{ maxHeight: 220 }}>
                  {availableToAdd.length === 0 ? (
                    <Text style={styles.modalEmpty}>Everyone is already in this group.</Text>
                  ) : availableToAdd.map(s => (
                    <TouchableOpacity key={s.user_id} style={styles.staffRow} onPress={() => addMemberToGroup(s)}>
                      <View style={[styles.staffAvatar, { backgroundColor: roleColor(s.role) }]}><Text style={styles.staffAvatarText}>{s.full_name.charAt(0)}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.staffName}>{s.full_name}</Text>
                        <Text style={styles.staffRole}>{s.role?.toUpperCase()}</Text>
                      </View>
                      <View style={styles.addBadge}><Text style={styles.addBadgeText}>+ Add</Text></View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowManageMembers(false)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabBar: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#2563eb" },
  selectLabel: { fontSize: 14, color: "#6b7280", marginBottom: 16, fontWeight: "500" },
  clientRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  clientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", marginRight: 12 },
  clientAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  clientName: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  groupMemberCount: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  chevron: { fontSize: 20, color: "#d1d5db" },
  backRow: { backgroundColor: "#1a2234", paddingHorizontal: 16, paddingVertical: 10 },
  backRowText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  groupHeaderRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1a2234", paddingHorizontal: 16, paddingVertical: 10 },
  manageBtn: { backgroundColor: "#2563eb", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  manageBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  channelLabel: { backgroundColor: "#eff6ff", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#dbeafe" },
  channelLabelText: { fontSize: 12, color: "#3b82f6" },
  quickScroll: { maxHeight: 44, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  quickBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f3f4f6", borderRadius: 20, borderWidth: 1, borderColor: "#e5e7eb" },
  quickBtnText: { fontSize: 12, color: "#374151" },
  emptyChat: { alignItems: "center", paddingVertical: 60 },
  emptyChatEmoji: { fontSize: 40, marginBottom: 12 },
  emptyChatText: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
  newGroupBtn: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  newGroupBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12 },
  msgRowMe: { flexDirection: "row-reverse" },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 8 },
  msgAvatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  msgBubble: { maxWidth: "75%", backgroundColor: "#fff", borderRadius: 16, borderBottomLeftRadius: 4, padding: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  msgBubbleMe: { backgroundColor: "#2563eb", borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  msgSender: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  msgText: { fontSize: 14, color: "#111827", lineHeight: 20 },
  msgTextMe: { color: "#fff" },
  msgTime: { fontSize: 10, color: "#9ca3af", marginTop: 4, textAlign: "right" },
  msgTimeMe: { color: "#93c5fd" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f3f4f6", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#111827", maxHeight: 100, backgroundColor: "#f9fafb" },
  sendBtn: { width: 40, height: 40, backgroundColor: "#2563eb", borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: "#93c5fd" },
  sendBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalPanel: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "88%" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 4 },
  modalSub: { fontSize: 13, color: "#6b7280", marginBottom: 16 },
  modalEmpty: { textAlign: "center", color: "#9ca3af", paddingVertical: 16, fontSize: 13 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5, marginTop: 4 },
  textInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", marginBottom: 16, backgroundColor: "#fff" },
  staffRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 12 },
  staffAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  staffAvatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  staffName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  staffRole: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  checkboxCheck: { color: "#fff", fontSize: 14, fontWeight: "800" },
  removeBtn: { backgroundColor: "#fef2f2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  removeBtnText: { color: "#dc2626", fontSize: 12, fontWeight: "700" },
  addBadge: { backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBadgeText: { color: "#2563eb", fontSize: 12, fontWeight: "700" },
  primaryBtn: { backgroundColor: "#2563eb", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 16, marginBottom: 8 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalCancel: { paddingVertical: 10, alignItems: "center" },
  modalCancelText: { color: "#6b7280", fontSize: 14, fontWeight: "600" },
  doneBtn: { backgroundColor: "#f3f4f6", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  doneBtnText: { color: "#374151", fontSize: 15, fontWeight: "700" },
});