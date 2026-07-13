import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import {
  TwilioVideo,
  TwilioVideoLocalView,
  TwilioVideoParticipantView,
} from "@twilio/video-react-native-sdk";
import { supabase } from "../../lib/supabase";

// TODO: point this at your shared API base URL constant if one exists elsewhere in the app
const API_URL = "https://aba-ai-assistant.com";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  bcba: "BCBA",
  rbt: "RBT",
  guardian: "Guardian",
};

function parseIdentity(identity: string): { id: string; name: string; role: string } {
  const [id, encodedName, role] = identity.split("::");
  return {
    id: id ?? identity,
    name: encodedName ? decodeURIComponent(encodedName) : identity,
    role: role ?? "",
  };
}

type Client = { id: string; full_name: string };
type ActiveSession = { id: string; room_name: string; status: string };
type ChatMessage = { id: string; message: string; sender_name: string; sender_role: string; created_at: string };

export default function TelehealthTab() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [loadingClients, setLoadingClients] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [checkingActive, setCheckingActive] = useState(false);
  const [recordSession, setRecordSession] = useState(false);

  const [token, setToken] = useState("");
  const [roomName, setRoomName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [hostUserId, setHostUserId] = useState("");
  const [localIdentity, setLocalIdentity] = useState<{ id: string; name: string; role: string } | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState<{ sid: string; identity: string }[]>([]);
  const [videoTracks, setVideoTracks] = useState(new Map());

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatPollRef = useRef<any>(null);

  const twilioRef = useRef<any>(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (!clientId) {
      setActiveSession(null);
      return;
    }
    checkActiveSession(clientId);
  }, [clientId]);

  useEffect(() => {
    if (!chatOpen || !connected || !sessionId || !roomName) return;
    loadChatMessages();
    chatPollRef.current = setInterval(loadChatMessages, 3000);
    return () => clearInterval(chatPollRef.current);
  }, [chatOpen, connected, sessionId, roomName]);

  async function loadClients() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      setLoadingClients(false);
      return;
    }

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!companyUser) {
      setLoadingClients(false);
      return;
    }

    const isPrivileged = companyUser.role === "admin" || companyUser.role === "bcba";

    if (isPrivileged) {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("company_id", companyUser.company_id)
        .order("full_name");
      setClients(data ?? []);
    } else {
      const { data } = await supabase
        .from("client_assignments")
        .select("client_id, clients(id, full_name)")
        .eq("user_id", user.id);
      const assigned = (data ?? [])
        .map((row: any) => row.clients)
        .filter(Boolean)
        .sort((a: Client, b: Client) => a.full_name.localeCompare(b.full_name));
      setClients(assigned);
    }

    setLoadingClients(false);
  }

  async function checkActiveSession(selectedClientId: string) {
    setCheckingActive(true);
    setActiveSession(null);
    const { data } = await supabase
      .from("telehealth_video_sessions")
      .select("id, room_name, status")
      .eq("client_id", selectedClientId)
      .in("status", ["scheduled", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveSession(data ?? null);
    setCheckingActive(false);
  }

  async function joinExisting() {
    if (!activeSession) return;
    setConnecting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
        setConnecting(false);
        return;
      }

      const tokenRes = await fetch(`${API_URL}/api/video/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ roomName: activeSession.room_name, telehealthSessionId: activeSession.id }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || "Failed to get video token");
      }

      const { token: accessToken, hostUserId: host, identity } = await tokenRes.json();
      setToken(accessToken);
      setRoomName(activeSession.room_name);
      setSessionId(activeSession.id);
      setHostUserId(host ?? "");
      if (identity) setLocalIdentity(parseIdentity(identity));

      twilioRef.current?.connect({ accessToken, roomName: activeSession.room_name });
    } catch (err: any) {
      console.error("Failed to join telehealth call:", err);
      setError(err.message || "Failed to join session");
      setConnecting(false);
    }
  }

  async function startCall() {
    if (!clientId) {
      setError("Select a client to start a session");
      return;
    }
    setConnecting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
        setConnecting(false);
        return;
      }

      const createRes = await fetch(`${API_URL}/api/video/create-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clientId, recordSession, inviteGuardian: true }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Failed to start session");
      }

      const { roomName: newRoomName, session: createdSession } = await createRes.json();

      const tokenRes = await fetch(`${API_URL}/api/video/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ roomName: newRoomName, telehealthSessionId: createdSession.id }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || "Failed to get video token");
      }

      const { token: accessToken, hostUserId: host, identity } = await tokenRes.json();
      setToken(accessToken);
      setRoomName(newRoomName);
      setSessionId(createdSession.id);
      setHostUserId(host ?? "");
      if (identity) setLocalIdentity(parseIdentity(identity));

      twilioRef.current?.connect({ accessToken, roomName: newRoomName });
    } catch (err: any) {
      console.error("Failed to start telehealth call:", err);
      setError(err.message || "Failed to start session");
      setConnecting(false);
    }
  }

  async function loadChatMessages() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/api/video/chat/list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ telehealthSessionId: sessionId, roomName }),
      });
      if (!res.ok) return;
      const { messages } = await res.json();
      setChatMessages(messages ?? []);
    } catch (err) {
      console.error("Failed to load chat:", err);
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim()) return;
    setSendingChat(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_URL}/api/video/chat/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ telehealthSessionId: sessionId, roomName, message: chatInput.trim() }),
      });
      if (res.ok) {
        const { message } = await res.json();
        setChatMessages((prev) => [...prev, message]);
        setChatInput("");
      }
    } catch (err) {
      console.error("Failed to send chat message:", err);
    } finally {
      setSendingChat(false);
    }
  }

  function endCall() {
    twilioRef.current?.disconnect();
  }

  function toggleMic() {
    twilioRef.current
      ?.setLocalAudioEnabled(!isAudioEnabled)
      .then((enabled: boolean) => setIsAudioEnabled(enabled));
  }

  function toggleCamera() {
    twilioRef.current
      ?.setLocalVideoEnabled(!isVideoEnabled)
      .then((enabled: boolean) => setIsVideoEnabled(enabled));
  }

  function flipCamera() {
    twilioRef.current?.flipCamera();
  }

  const onRoomDidConnect = () => {
    setConnecting(false);
    setConnected(true);
  };

  const onRoomDidDisconnect = () => {
    setConnected(false);
    setConnecting(false);
    setParticipants([]);
    setVideoTracks(new Map());
    setChatOpen(false);
    setChatMessages([]);
  };

  const onRoomDidFailToConnect = ({ error: connectError }: any) => {
    setConnecting(false);
    setError(connectError?.message || "Failed to connect to room");
  };

  const onParticipantAddedVideoTrack = ({ participant, track }: any) => {
    setVideoTracks((prev) => new Map(prev).set(track.trackSid, { participantSid: participant.sid, videoTrackSid: track.trackSid }));
  };

  const onParticipantRemovedVideoTrack = ({ track }: any) => {
    setVideoTracks((prev) => {
      const next = new Map(prev);
      next.delete(track.trackSid);
      return next;
    });
  };

  const onRoomParticipantDidConnect = ({ participant }: any) => {
    setParticipants((prev) => [...prev.filter((p) => p.sid !== participant.sid), { sid: participant.sid, identity: participant.identity }]);
  };

  const onRoomParticipantDidDisconnect = ({ participant }: any) => {
    setParticipants((prev) => prev.filter((p) => p.sid !== participant.sid));
  };

  function findParticipantForTrack(track: any) {
    return participants.find((p) => p.sid === track.participantSid);
  }

  // --- Pre-call: client picker ---
  if (!connected && !connecting) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Telehealth</Text>
          <TouchableOpacity onPress={() => router.push("/telehealth-history")}>
            <Text style={styles.historyLink}>History →</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Start a video session with a client.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Client</Text>
          {loadingClients ? (
            <ActivityIndicator />
          ) : (
            <Picker selectedValue={clientId} onValueChange={setClientId} style={styles.picker}>
              <Picker.Item label={clients.length === 0 ? "No assigned clients" : "Select client..."} value="" />
              {clients.map((c) => (
                <Picker.Item key={c.id} label={c.full_name} value={c.id} />
              ))}
            </Picker>
          )}

          {checkingActive && <Text style={styles.subtitle}>Checking for an active session...</Text>}

          {activeSession && !checkingActive && (
            <View style={styles.activeBox}>
              <Text style={styles.activeText}>
                A telehealth session for this client is already {activeSession.status === "in_progress" ? "in progress" : "scheduled"}.
              </Text>
              <TouchableOpacity style={styles.button} onPress={joinExisting}>
                <Text style={styles.buttonText}>Join Existing Session</Text>
              </TouchableOpacity>
            </View>
          )}

          {!activeSession && !checkingActive && (
            <>
              <TouchableOpacity style={styles.checkboxRow} onPress={() => setRecordSession(!recordSession)}>
                <View style={[styles.checkbox, recordSession && styles.checkboxChecked]}>
                  {recordSession && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Record this session</Text>
              </TouchableOpacity>

              {error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                style={[styles.button, !clientId && styles.buttonDisabled]}
                disabled={!clientId}
                onPress={startCall}
              >
                <Text style={styles.buttonText}>Start Video Session</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  // --- Connecting ---
  if (connecting) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.subtitle}>Connecting to session...</Text>
        <TwilioVideo
          ref={twilioRef}
          onRoomDidConnect={onRoomDidConnect}
          onRoomDidDisconnect={onRoomDidDisconnect}
          onRoomDidFailToConnect={onRoomDidFailToConnect}
          onParticipantAddedVideoTrack={onParticipantAddedVideoTrack}
          onParticipantRemovedVideoTrack={onParticipantRemovedVideoTrack}
          onRoomParticipantDidConnect={onRoomParticipantDidConnect}
          onRoomParticipantDidDisconnect={onRoomParticipantDidDisconnect}
        />
      </View>
    );
  }

  // --- In call ---
  return (
    <View style={styles.callContainer}>
      <View style={styles.videoGrid}>
        {Array.from(videoTracks, ([trackSid, track]) => {
          const p = findParticipantForTrack(track);
          const identity = p ? parseIdentity(p.identity) : null;
          const isHost = identity?.id === hostUserId;
          return (
            <View key={trackSid} style={styles.remoteVideoWrap}>
              <TwilioVideoParticipantView trackIdentifier={track} style={styles.remoteVideo} />
              <View style={styles.nameTag}>
                <Text style={styles.nameTagText}>
                  {identity?.name ?? "Participant"}{identity?.role ? ` · ${ROLE_LABELS[identity.role] ?? identity.role}` : ""}
                </Text>
                {isHost && <Text style={styles.hostBadge}>Host</Text>}
              </View>
            </View>
          );
        })}
        <View style={styles.localVideoWrap}>
          <TwilioVideoLocalView enabled={isVideoEnabled} style={styles.localVideo} />
          <View style={styles.nameTag}>
            <Text style={styles.nameTagText}>
              You{localIdentity?.role ? ` · ${ROLE_LABELS[localIdentity.role] ?? localIdentity.role}` : ""}
            </Text>
            {localIdentity?.id === hostUserId && <Text style={styles.hostBadge}>Host</Text>}
          </View>
        </View>
      </View>

      {chatOpen && (
        <View style={styles.chatPanel}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatHeaderText}>Session Chat</Text>
            <TouchableOpacity onPress={() => setChatOpen(false)}>
              <Text style={styles.chatClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={chatMessages}
            keyExtractor={(item) => item.id}
            style={styles.chatList}
            renderItem={({ item }) => (
              <View style={styles.chatMessageRow}>
                <Text style={styles.chatSender}>
                  {item.sender_name}{item.sender_role ? ` · ${ROLE_LABELS[item.sender_role] ?? item.sender_role}` : ""}
                </Text>
                <Text style={styles.chatBubble}>{item.message}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.chatEmpty}>No messages yet</Text>}
          />
          <View style={styles.chatInputRow}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Type a message..."
              placeholderTextColor="#6b7280"
              style={styles.chatInput}
              onSubmitEditing={sendChatMessage}
            />
            <TouchableOpacity onPress={sendChatMessage} disabled={sendingChat || !chatInput.trim()} style={styles.chatSendButton}>
              <Text style={styles.chatSendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.controlButton, !isAudioEnabled && styles.controlButtonOff]} onPress={toggleMic}>
          <Text style={styles.controlText}>{isAudioEnabled ? "Mute" : "Unmute"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, !isVideoEnabled && styles.controlButtonOff]} onPress={toggleCamera}>
          <Text style={styles.controlText}>{isVideoEnabled ? "Camera Off" : "Camera On"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={flipCamera}>
          <Text style={styles.controlText}>Flip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, chatOpen && styles.controlButtonActive]} onPress={() => setChatOpen(!chatOpen)}>
          <Text style={styles.controlText}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.leaveButton} onPress={endCall}>
          <Text style={styles.controlText}>Leave</Text>
        </TouchableOpacity>
      </View>

      <TwilioVideo
        ref={twilioRef}
        onRoomDidConnect={onRoomDidConnect}
        onRoomDidDisconnect={onRoomDidDisconnect}
        onRoomDidFailToConnect={onRoomDidFailToConnect}
        onParticipantAddedVideoTrack={onParticipantAddedVideoTrack}
        onParticipantRemovedVideoTrack={onParticipantRemovedVideoTrack}
        onRoomParticipantDidConnect={onRoomParticipantDidConnect}
        onRoomParticipantDidDisconnect={onRoomParticipantDidDisconnect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyLink: { fontSize: 13, color: "#2563eb", fontWeight: "600" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#111827" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  label: { fontSize: 13, fontWeight: "600", color: "#374151" },
  picker: { backgroundColor: "#f9fafb", borderRadius: 8 },
  error: { color: "#dc2626", fontSize: 13 },
  activeBox: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  activeText: { fontSize: 13, color: "#1e40af", fontWeight: "500" },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  checkboxLabel: { fontSize: 14, color: "#374151" },
  button: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  buttonDisabled: { backgroundColor: "#9ca3af" },
  buttonText: { color: "#fff", fontWeight: "600" },
  callContainer: { flex: 1, backgroundColor: "#111827" },
  videoGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  remoteVideoWrap: { width: "100%", height: "50%", position: "relative" },
  remoteVideo: { width: "100%", height: "100%" },
  localVideoWrap: { position: "absolute", bottom: 100, right: 12, width: 100, height: 140, borderRadius: 8, overflow: "hidden" },
  localVideo: { width: "100%", height: "100%" },
  nameTag: { position: "absolute", bottom: 4, left: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  nameTagText: { color: "#fff", fontSize: 10, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  hostBadge: { color: "#fff", fontSize: 9, fontWeight: "700", backgroundColor: "#2563eb", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  controls: { flexDirection: "row", justifyContent: "center", gap: 10, padding: 16, backgroundColor: "#1f2937" },
  controlButton: { backgroundColor: "#374151", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  controlButtonOff: { backgroundColor: "#dc2626" },
  controlButtonActive: { backgroundColor: "#2563eb" },
  leaveButton: { backgroundColor: "#dc2626", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20 },
  controlText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  chatPanel: { position: "absolute", bottom: 70, left: 0, right: 0, top: 0, backgroundColor: "#1f2937", zIndex: 10 },
  chatHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#374151" },
  chatHeaderText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  chatClose: { color: "#9ca3af", fontSize: 18 },
  chatList: { flex: 1, padding: 12 },
  chatMessageRow: { marginBottom: 10 },
  chatSender: { color: "#9ca3af", fontSize: 11, marginBottom: 2 },
  chatBubble: { color: "#fff", fontSize: 13, backgroundColor: "#374151", padding: 8, borderRadius: 8 },
  chatEmpty: { color: "#6b7280", fontSize: 12, textAlign: "center", marginTop: 20 },
  chatInputRow: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: "#374151" },
  chatInput: { flex: 1, backgroundColor: "#111827", color: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  chatSendButton: { backgroundColor: "#2563eb", paddingHorizontal: 16, borderRadius: 8, justifyContent: "center" },
  chatSendText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
