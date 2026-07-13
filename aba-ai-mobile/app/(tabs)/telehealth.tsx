import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Picker } from "@react-native-picker/picker";
import {
  TwilioVideo,
  TwilioVideoLocalView,
  TwilioVideoParticipantView,
} from "@twilio/video-react-native-sdk";
import { supabase } from "../../lib/supabase";

// TODO: point this at your shared API base URL constant if one exists elsewhere in the app
const API_URL = "https://aba-ai-assistant.com";

type Client = { id: string; full_name: string };

export default function TelehealthTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [loadingClients, setLoadingClients] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [token, setToken] = useState("");
  const [roomName, setRoomName] = useState("");
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState<{ sid: string; identity: string }[]>([]);
  const [videoTracks, setVideoTracks] = useState(new Map());

  const twilioRef = useRef<any>(null);

  useEffect(() => {
    loadClients();
  }, []);

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
        body: JSON.stringify({ clientId, inviteGuardian: true }),
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

      const { token: accessToken } = await tokenRes.json();
      setToken(accessToken);
      setRoomName(newRoomName);

      twilioRef.current?.connect({ accessToken, roomName: newRoomName });
    } catch (err: any) {
      console.error("Failed to start telehealth call:", err);
      setError(err.message || "Failed to start session");
      setConnecting(false);
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

  // --- Pre-call: client picker ---
  if (!connected && !connecting) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Telehealth</Text>
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

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, !clientId && styles.buttonDisabled]}
            disabled={!clientId}
            onPress={startCall}
          >
            <Text style={styles.buttonText}>Start Video Session</Text>
          </TouchableOpacity>
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
        {Array.from(videoTracks, ([trackSid, track]) => (
          <TwilioVideoParticipantView key={trackSid} trackIdentifier={track} style={styles.remoteVideo} />
        ))}
        <TwilioVideoLocalView enabled={isVideoEnabled} style={styles.localVideo} />
      </View>

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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#111827" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  label: { fontSize: 13, fontWeight: "600", color: "#374151" },
  picker: { backgroundColor: "#f9fafb", borderRadius: 8 },
  error: { color: "#dc2626", fontSize: 13 },
  button: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  buttonDisabled: { backgroundColor: "#9ca3af" },
  buttonText: { color: "#fff", fontWeight: "600" },
  callContainer: { flex: 1, backgroundColor: "#111827" },
  videoGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  remoteVideo: { width: "100%", height: "50%" },
  localVideo: { position: "absolute", bottom: 100, right: 12, width: 100, height: 140, borderRadius: 8, overflow: "hidden" },
  controls: { flexDirection: "row", justifyContent: "center", gap: 10, padding: 16, backgroundColor: "#1f2937" },
  controlButton: { backgroundColor: "#374151", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  controlButtonOff: { backgroundColor: "#dc2626" },
  leaveButton: { backgroundColor: "#dc2626", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20 },
  controlText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
