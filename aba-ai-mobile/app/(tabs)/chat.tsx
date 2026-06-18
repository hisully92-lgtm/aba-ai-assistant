import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView
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

type ChatMode = "team" | "students" | "supervisors";

const QUICK_MESSAGES = [
  "Question for supervisor",
  "Completed supervision hours",
  "Need MVF signed",
  "Available for session",
  "Submitted hours for review",
];

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
    if (mode !== "team" && companyId) {
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
  }, [selectedClient, mode, companyId]);

  useEffect(() => {
    if (mode !== "team" && companyId) loadStudentMessages();
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

  return (
    <View style={styles.container}>
      <AppHeader title="Chat" />

      {/* MODE TABS */}
      <View style={styles.tabBar}>
        {([
          { key: "team", label: "Team Chat" },
          { key: "students", label: "Students" },
          { key: "supervisors", label: "Supervisors" },
        ] as { key: ChatMode; label: string }[]).map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.tab, mode === tab.key && styles.tabActive]}
            onPress={() => { setMode(tab.key); setSelectedClient(null); setMessages([]); }}>
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

      {/* CHAT VIEW */}
      {(mode !== "team" || selectedClient) && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
          {/* Back button for team chat */}
          {mode === "team" && selectedClient && (
            <TouchableOpacity style={styles.backRow} onPress={() => { setSelectedClient(null); setMessages([]); }}>
              <Text style={styles.backRowText}>‹ {selectedClient.full_name}</Text>
            </TouchableOpacity>
          )}

          {/* Channel label for student/supervisor */}
          {mode !== "team" && (
            <View style={styles.channelLabel}>
              <Text style={styles.channelLabelText}>
                {mode === "students" ? "🎓 Chat with other student analysts" : "👩‍🏫 Chat with BCBAs, supervisors, and directors"}
              </Text>
            </View>
          )}

          {/* Quick messages for student channels */}
          {mode !== "team" && (
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
              placeholder={mode === "team" ? "Message the team..." : mode === "students" ? "Message students..." : "Message supervisors..."}
              multiline maxLength={500} />
            <TouchableOpacity style={[styles.sendBtn, !messageText.trim() && styles.sendBtnDisabled]}
              onPress={() => handleSend()} disabled={!messageText.trim() || sending}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>↑</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabBar: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#2563eb" },
  selectLabel: { fontSize: 14, color: "#6b7280", marginBottom: 16, fontWeight: "500" },
  clientRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  clientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", marginRight: 12 },
  clientAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  clientName: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  chevron: { fontSize: 20, color: "#d1d5db" },
  backRow: { backgroundColor: "#1a2234", paddingHorizontal: 16, paddingVertical: 10 },
  backRowText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  channelLabel: { backgroundColor: "#eff6ff", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#dbeafe" },
  channelLabelText: { fontSize: 12, color: "#3b82f6" },
  quickScroll: { maxHeight: 44, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  quickBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f3f4f6", borderRadius: 20, borderWidth: 1, borderColor: "#e5e7eb" },
  quickBtnText: { fontSize: 12, color: "#374151" },
  emptyChat: { alignItems: "center", paddingVertical: 60 },
  emptyChatEmoji: { fontSize: 40, marginBottom: 12 },
  emptyChatText: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
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
});
