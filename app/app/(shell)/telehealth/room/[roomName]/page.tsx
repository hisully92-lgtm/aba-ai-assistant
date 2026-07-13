"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Video, { Room, RemoteParticipant, RemoteTrack, LocalVideoTrack } from "twilio-video";

type ParsedIdentity = { id: string; name: string; role: string };

function parseIdentity(identity: string): ParsedIdentity {
  const [id, encodedName, role] = identity.split("::");
  return {
    id: id ?? identity,
    name: encodedName ? decodeURIComponent(encodedName) : identity,
    role: role ?? "",
  };
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  bcba: "BCBA",
  rbt: "RBT",
  guardian: "Guardian",
};

export default function TelehealthAppRoomPage() {
  const params = useParams<{ roomName: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomName = params?.roomName ?? "";
  const telehealthSessionId = searchParams?.get("sessionId") ?? "";

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hostUserId, setHostUserId] = useState("");
  const [localIdentity, setLocalIdentity] = useState<ParsedIdentity | null>(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; message: string; sender_name: string; sender_role: string; created_at: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const screenTrackRef = useRef<LocalVideoTrack | null>(null);

  useEffect(() => {
    if (!roomName || !telehealthSessionId) {
      setError("Missing room or session reference");
      setConnecting(false);
      return;
    }

    let activeRoom: Room | null = null;

    async function connectToRoom() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Not authenticated");
          setConnecting(false);
          return;
        }

        const res = await fetch("/api/video/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ roomName, telehealthSessionId }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to get video token");
        }

        const { token, hostUserId: host } = await res.json();
        setHostUserId(host ?? "");

        activeRoom = await Video.connect(token, {
          name: roomName,
          audio: true,
          video: { width: 640, height: 480 },
        });

        setLocalIdentity(parseIdentity(activeRoom.localParticipant.identity));
        setRoom(activeRoom);
        setConnecting(false);

        activeRoom.localParticipant.videoTracks.forEach((publication) => {
          if (publication.track && localVideoRef.current) {
            localVideoTrackRef.current = publication.track;
            localVideoRef.current.appendChild(publication.track.attach());
          }
        });

        const attachParticipant = (participant: RemoteParticipant) => {
          setParticipants((prev) => [...prev.filter((p) => p.sid !== participant.sid), participant]);
        };

        activeRoom.participants.forEach(attachParticipant);
        activeRoom.on("participantConnected", attachParticipant);
        activeRoom.on("participantDisconnected", (participant) => {
          setParticipants((prev) => prev.filter((p) => p.sid !== participant.sid));
        });

        activeRoom.on("disconnected", () => {
          router.push("/app/telehealth");
        });
      } catch (err: any) {
        console.error("Failed to connect to room:", err);
        setError(err.message || "Failed to connect");
        setConnecting(false);
      }
    }

    connectToRoom();

    return () => {
      if (activeRoom) activeRoom.disconnect();
    };
  }, [roomName, telehealthSessionId, router]);

  useEffect(() => {
    if (!chatOpen || !telehealthSessionId || !roomName) return;
    let cancelled = false;

    async function loadMessages() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch("/api/video/chat/list", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ telehealthSessionId, roomName }),
        });
        if (!res.ok || cancelled) return;
        const { messages } = await res.json();
        if (!cancelled) setChatMessages(messages ?? []);
      } catch (err) {
        console.error("Failed to load chat messages:", err);
      }
    }

    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chatOpen, telehealthSessionId, roomName]);

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || !telehealthSessionId || !roomName) return;
    setSendingChat(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/video/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ telehealthSessionId, roomName, message: chatInput.trim() }),
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
  }, [chatInput, telehealthSessionId, roomName]);

  const toggleScreenShare = useCallback(async () => {
    if (!room) return;

    if (isSharingScreen) {
      const track = screenTrackRef.current;
      if (track) {
        room.localParticipant.unpublishTrack(track);
        track.stop();
      }
      screenTrackRef.current = null;
      setIsSharingScreen(false);
      return;
    }

    try {
      // @ts-ignore
      const stream: MediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const mediaTrack = stream.getVideoTracks()[0];
      const screenTrack = new Video.LocalVideoTrack(mediaTrack, { name: "screen-share" });
      await room.localParticipant.publishTrack(screenTrack);
      screenTrackRef.current = screenTrack;
      setIsSharingScreen(true);
      mediaTrack.addEventListener("ended", () => {
        room.localParticipant.unpublishTrack(screenTrack);
        screenTrackRef.current = null;
        setIsSharingScreen(false);
      });
    } catch (err) {
      console.error("Screen share failed or was cancelled:", err);
    }
  }, [room, isSharingScreen]);

  const toggleMic = useCallback(() => {
    if (!room) return;
    room.localParticipant.audioTracks.forEach((pub) => {
      micEnabled ? pub.track.disable() : pub.track.enable();
    });
    setMicEnabled(!micEnabled);
  }, [room, micEnabled]);

  const toggleCamera = useCallback(async () => {
    if (!room) return;

    if (cameraEnabled) {
      room.localParticipant.videoTracks.forEach((pub) => pub.track.disable());
      setCameraEnabled(false);
      return;
    }

    const existingTrack = localVideoTrackRef.current;
    const stillPublished = Array.from(room.localParticipant.videoTracks.values()).some(
      (pub) => pub.track === existingTrack
    );

    if (existingTrack && stillPublished) {
      existingTrack.enable();
      setCameraEnabled(true);
      return;
    }

    try {
      const freshTrack = await Video.createLocalVideoTrack({ width: 640, height: 480 });
      await room.localParticipant.publishTrack(freshTrack);
      localVideoTrackRef.current = freshTrack;
      if (localVideoRef.current) {
        localVideoRef.current.appendChild(freshTrack.attach());
      }
      setCameraEnabled(true);
    } catch (err) {
      console.error("Failed to re-acquire camera track:", err);
      setError("Could not turn camera back on — check camera permissions");
    }
  }, [room, cameraEnabled]);

  const leaveCall = useCallback(() => {
    room?.disconnect();
    router.push("/app/telehealth");
  }, [room, router]);

  if (connecting) {
    return (
      <div className="flex items-center justify-center h-screen text-white" style={{ backgroundColor: "#0f172a" }}>
        <p>Connecting to session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white gap-4" style={{ backgroundColor: "#0f172a" }}>
        <p className="text-red-400 px-6 text-center">{error}</p>
        <button onClick={() => router.push("/app/telehealth")} className="px-4 py-2 bg-blue-600 rounded-lg">
          Back
        </button>
      </div>
    );
  }

  const totalTiles = participants.length + 1;
  const gridCols =
    totalTiles <= 1 ? "grid-cols-1" : totalTiles <= 4 ? "grid-cols-2" : "grid-cols-3";

  const isLocalHost = !!localIdentity && localIdentity.id === hostUserId;

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#0f172a" }}>
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 grid ${gridCols} gap-2 p-2 overflow-auto`}>
          <div
            ref={localVideoRef}
            className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          >
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
              <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">
                You{localIdentity?.role ? ` · ${ROLE_LABELS[localIdentity.role] ?? localIdentity.role}` : ""}
              </span>
              {isLocalHost && (
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-semibold">Host</span>
              )}
            </div>
          </div>
          {participants.map((participant) => (
            <ParticipantTile
              key={participant.sid}
              participant={participant}
              isHost={parseIdentity(participant.identity).id === hostUserId}
            />
          ))}
        </div>

        {chatOpen && (
          <div className="w-72 flex flex-col" style={{ backgroundColor: "#1a2234", borderLeft: "1px solid #2a3a54" }}>
            <div className="px-4 py-3 text-white font-semibold text-sm" style={{ borderBottom: "1px solid #2a3a54" }}>
              Session Chat
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && <p className="text-xs text-center mt-4" style={{ color: "#64748b" }}>No messages yet</p>}
              {chatMessages.map((m) => (
                <div key={m.id}>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>
                    {m.sender_name}{m.sender_role ? ` · ${ROLE_LABELS[m.sender_role] ?? m.sender_role}` : ""}
                  </p>
                  <p className="text-sm text-white rounded-lg px-3 py-2 mt-0.5 break-words" style={{ backgroundColor: "#2a3a54" }}>{m.message}</p>
                </div>
              ))}
            </div>
            <div className="p-3 flex gap-2" style={{ borderTop: "1px solid #2a3a54" }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !sendingChat && sendChatMessage()}
                placeholder="Type a message..."
                className="flex-1 text-white text-sm rounded-lg px-3 py-2 focus:outline-none"
                style={{ backgroundColor: "#0f172a" }}
              />
              <button
                onClick={sendChatMessage}
                disabled={sendingChat || !chatInput.trim()}
                className="px-3 py-2 text-white text-sm rounded-lg disabled:opacity-50"
                style={{ backgroundColor: "#2563eb" }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-3 p-4" style={{ backgroundColor: "#1a2234" }}>
        <button
          onClick={toggleMic}
          className="px-4 py-3 rounded-full text-white text-sm"
          style={{ backgroundColor: micEnabled ? "#374151" : "#dc2626" }}
        >
          {micEnabled ? "Mute" : "Unmute"}
        </button>
        <button
          onClick={toggleCamera}
          className="px-4 py-3 rounded-full text-white text-sm"
          style={{ backgroundColor: cameraEnabled ? "#374151" : "#dc2626" }}
        >
          {cameraEnabled ? "Camera Off" : "Camera On"}
        </button>
        <button
          onClick={toggleScreenShare}
          className="px-4 py-3 rounded-full text-white text-sm"
          style={{ backgroundColor: isSharingScreen ? "#2563eb" : "#374151" }}
        >
          {isSharingScreen ? "Stop Sharing" : "Share Screen"}
        </button>
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="px-4 py-3 rounded-full text-white text-sm"
          style={{ backgroundColor: chatOpen ? "#2563eb" : "#374151" }}
        >
          Chat
        </button>
        <button onClick={leaveCall} className="px-6 py-3 rounded-full text-white font-semibold text-sm" style={{ backgroundColor: "#dc2626" }}>
          Leave
        </button>
      </div>
    </div>
  );
}

function ParticipantTile({ participant, isHost }: { participant: RemoteParticipant; isHost: boolean }) {
  const videoRef = useRef<HTMLDivElement>(null);
  const identity = parseIdentity(participant.identity);

  useEffect(() => {
    const container = videoRef.current;
    if (!container) return;

    const attachTrack = (track: RemoteTrack) => {
      if (track.kind === "video" || track.kind === "audio") {
        // @ts-ignore
        container.appendChild(track.attach());
      }
    };

    participant.tracks.forEach((publication) => {
      if (publication.track) attachTrack(publication.track);
    });

    const handleSub = (track: RemoteTrack) => attachTrack(track);
    const handleUnsub = (track: RemoteTrack) => {
      if (track.kind === "video" || track.kind === "audio") {
        // @ts-ignore
        track.detach().forEach((el: HTMLElement) => el.remove());
      }
    };

    participant.on("trackSubscribed", handleSub);
    participant.on("trackUnsubscribed", handleUnsub);

    return () => {
      participant.removeAllListeners();
    };
  }, [participant]);

  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video [&>video]:w-full [&>video]:h-full [&>video]:object-cover">
      <div ref={videoRef} className="w-full h-full" />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">
          {identity.name}{identity.role ? ` · ${ROLE_LABELS[identity.role] ?? identity.role}` : ""}
        </span>
        {isHost && <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-semibold">Host</span>}
      </div>
    </div>
  );
}
