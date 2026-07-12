'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Video, { Room, RemoteParticipant, RemoteTrack } from 'twilio-video';

function parseIdentity(identity: string): { name: string; role: string } {
  const [, encodedName, role] = identity.split('::');
  return {
    name: encodedName ? decodeURIComponent(encodedName) : identity,
    role: role ?? '',
  };
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  bcba: 'BCBA',
  rbt: 'RBT',
  guardian: 'Guardian',
};

export default function TelehealthGuestJoinPage() {
  const params = useParams<{ token: string }>();
  const guestToken = params?.token ?? '';

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [left, setLeft] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; message: string; sender_name: string; sender_role: string; created_at: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  const localVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!guestToken) {
      setError('Missing invite link');
      setConnecting(false);
      return;
    }

    let activeRoom: Room | null = null;

    async function connectToRoom() {
      try {
        const res = await fetch('/api/video/guest-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestToken }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'This invite link is no longer valid');
        }

        const { token, roomName, clientName: name } = await res.json();
        setClientName(name);

        activeRoom = await Video.connect(token, {
          name: roomName,
          audio: true,
          video: { width: 640, height: 480 },
        });

        setRoom(activeRoom);
        setConnecting(false);

        activeRoom.localParticipant.videoTracks.forEach((publication) => {
          if (publication.track && localVideoRef.current) {
            localVideoRef.current.appendChild(publication.track.attach());
          }
        });

        const attachParticipant = (participant: RemoteParticipant) => {
          setParticipants((prev) => [...prev.filter((p) => p.sid !== participant.sid), participant]);
        };

        activeRoom.participants.forEach(attachParticipant);
        activeRoom.on('participantConnected', attachParticipant);
        activeRoom.on('participantDisconnected', (participant) => {
          setParticipants((prev) => prev.filter((p) => p.sid !== participant.sid));
        });
        activeRoom.on('disconnected', () => setLeft(true));
      } catch (err: any) {
        console.error('Failed to connect to room:', err);
        setError(err.message || 'Failed to connect');
        setConnecting(false);
      }
    }

    connectToRoom();

    return () => {
      if (activeRoom) activeRoom.disconnect();
    };
  }, [guestToken]);

  useEffect(() => {
    if (!chatOpen || !guestToken) return;
    let cancelled = false;

    async function loadMessages() {
      try {
        const res = await fetch('/api/video/chat/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestToken }),
        });
        if (!res.ok || cancelled) return;
        const { messages } = await res.json();
        if (!cancelled) setChatMessages(messages ?? []);
      } catch (err) {
        console.error('Failed to load chat messages:', err);
      }
    }

    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chatOpen, guestToken]);

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || !guestToken) return;
    setSendingChat(true);
    try {
      const res = await fetch('/api/video/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestToken, message: chatInput.trim() }),
      });
      if (res.ok) {
        const { message } = await res.json();
        setChatMessages((prev) => [...prev, message]);
        setChatInput('');
      }
    } catch (err) {
      console.error('Failed to send chat message:', err);
    } finally {
      setSendingChat(false);
    }
  }, [chatInput, guestToken]);

  const toggleMic = useCallback(() => {
    if (!room) return;
    room.localParticipant.audioTracks.forEach((pub) => {
      micEnabled ? pub.track.disable() : pub.track.enable();
    });
    setMicEnabled(!micEnabled);
  }, [room, micEnabled]);

  const toggleCamera = useCallback(() => {
    if (!room) return;
    room.localParticipant.videoTracks.forEach((pub) => {
      cameraEnabled ? pub.track.disable() : pub.track.enable();
    });
    setCameraEnabled(!cameraEnabled);
  }, [room, cameraEnabled]);

  const leaveCall = useCallback(() => {
    room?.disconnect();
    setLeft(true);
  }, [room]);

  if (left) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <p>You've left the session. You can close this window.</p>
      </div>
    );
  }

  if (connecting) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <p>Connecting...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const totalTiles = participants.length + 1;
  const gridCols =
    totalTiles <= 1 ? 'grid-cols-1' : totalTiles <= 2 ? 'grid-cols-2' : totalTiles <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <div className="text-center text-white text-sm py-2 bg-gray-800">{clientName}</div>
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 grid ${gridCols} gap-2 p-2 overflow-auto`}>
          <div
            ref={localVideoRef}
            className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          >
            <span className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">You</span>
          </div>
          {participants.map((participant) => (
            <ParticipantTile key={participant.sid} participant={participant} />
          ))}
        </div>

        {chatOpen && (
          <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700 text-white font-semibold text-sm">Session Chat</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-gray-500 text-xs text-center mt-4">No messages yet</p>
              )}
              {chatMessages.map((m) => (
                <div key={m.id}>
                  <p className="text-xs text-gray-400">{m.sender_name}</p>
                  <p className="text-sm text-white bg-gray-700 rounded-lg px-3 py-2 mt-0.5 break-words">{m.message}</p>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-700 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !sendingChat && sendChatMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 focus:outline-none"
              />
              <button
                onClick={sendChatMessage}
                disabled={sendingChat || !chatInput.trim()}
                className="px-3 py-2 bg-blue-600 disabled:bg-gray-600 text-white text-sm rounded-lg"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-4 p-4 bg-gray-800">
        <button onClick={toggleMic} className={`px-4 py-3 rounded-full ${micEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}>
          {micEnabled ? 'Mute' : 'Unmute'}
        </button>
        <button onClick={toggleCamera} className={`px-4 py-3 rounded-full ${cameraEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}>
          {cameraEnabled ? 'Camera Off' : 'Camera On'}
        </button>
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`px-4 py-3 rounded-full ${chatOpen ? 'bg-blue-600' : 'bg-gray-700'} text-white`}
        >
          Chat
        </button>
        <button onClick={leaveCall} className="px-6 py-3 rounded-full bg-red-600 text-white font-semibold">
          Leave
        </button>
      </div>
    </div>
  );
}

function ParticipantTile({ participant }: { participant: RemoteParticipant }) {
  const videoRef = useRef<HTMLDivElement>(null);
  const identity = parseIdentity(participant.identity);

  useEffect(() => {
    const container = videoRef.current;
    if (!container) return;

    const attachTrack = (track: RemoteTrack) => {
      if (track.kind === 'video' || track.kind === 'audio') {
        // @ts-ignore
        container.appendChild(track.attach());
      }
    };

    participant.tracks.forEach((publication) => {
      if (publication.track) attachTrack(publication.track);
    });

    const handleTrackSubscribed = (track: RemoteTrack) => attachTrack(track);
    const handleTrackUnsubscribed = (track: RemoteTrack) => {
      if (track.kind === 'video' || track.kind === 'audio') {
        // @ts-ignore
        track.detach().forEach((el: HTMLElement) => el.remove());
      }
    };

    participant.on('trackSubscribed', handleTrackSubscribed);
    participant.on('trackUnsubscribed', handleTrackUnsubscribed);

    return () => {
      participant.removeAllListeners();
    };
  }, [participant]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video [&>video]:w-full [&>video]:h-full [&>video]:object-cover">
      <div ref={videoRef} className="w-full h-full" />
      <span className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
        {identity.name}{identity.role ? ` · ${ROLE_LABELS[identity.role] ?? identity.role}` : ''}
      </span>
    </div>
  );
}
