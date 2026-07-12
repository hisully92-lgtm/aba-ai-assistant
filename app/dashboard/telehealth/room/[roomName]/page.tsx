'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { RemoteParticipant, RemoteTrack, LocalVideoTrack } from 'twilio-video';
import Video from 'twilio-video';
import { useTelehealthCall } from '@/lib/contexts/TelehealthCallContext';

type ParsedIdentity = { id: string; name: string; role: string };

function parseIdentity(identity: string): ParsedIdentity {
  const [id, encodedName, role] = identity.split('::');
  return {
    id: id ?? identity,
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

export default function TelehealthRoomPage() {
  const params = useParams<{ roomName: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlRoomName = params?.roomName ?? '';
  const urlSessionId = searchParams?.get('sessionId') ?? '';

  const call = useTelehealthCall();

  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; message: string; sender_name: string; sender_role: string; created_at: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<number | null>(null);

  const screenTrackRef = useRef<LocalVideoTrack | null>(null);
  const leavingRef = useRef(false);

  useEffect(() => {
    if (!urlRoomName || !urlSessionId) return;
    call.connect(urlRoomName, urlSessionId);
  }, [urlRoomName, urlSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When this page unmounts (navigating elsewhere) without an explicit Leave,
  // hand the call off to the floating window instead of disconnecting it.
  useEffect(() => {
    return () => {
      if (!leavingRef.current) {
        call.minimize();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!call.room) return;
    // @ts-ignore
    setNetworkQuality(call.room.localParticipant.networkQualityLevel ?? null);
    const handler = (level: number) => setNetworkQuality(level);
    call.room.localParticipant.on('networkQualityLevelChanged', handler);
    return () => {
      call.room?.localParticipant.off('networkQualityLevelChanged', handler);
    };
  }, [call.room]);

  useEffect(() => {
    if (!chatOpen || !urlSessionId || !urlRoomName) return;
    let cancelled = false;

    async function loadMessages() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch('/api/video/chat/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ telehealthSessionId: urlSessionId, roomName: urlRoomName }),
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
  }, [chatOpen, urlSessionId, urlRoomName]);

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || !urlSessionId || !urlRoomName) return;
    setSendingChat(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/video/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ telehealthSessionId: urlSessionId, roomName: urlRoomName, message: chatInput.trim() }),
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
  }, [chatInput, urlSessionId, urlRoomName]);

  const toggleScreenShare = useCallback(async () => {
    const activeRoom = call.room;
    if (!activeRoom) return;

    if (isSharingScreen) {
      const track = screenTrackRef.current;
      if (track) {
        activeRoom.localParticipant.unpublishTrack(track);
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
      const screenTrack = new Video.LocalVideoTrack(mediaTrack, { name: 'screen-share' });
      await activeRoom.localParticipant.publishTrack(screenTrack);
      screenTrackRef.current = screenTrack;
      setIsSharingScreen(true);
      mediaTrack.addEventListener('ended', () => {
        activeRoom.localParticipant.unpublishTrack(screenTrack);
        screenTrackRef.current = null;
        setIsSharingScreen(false);
      });
    } catch (err) {
      console.error('Screen share failed or was cancelled:', err);
    }
  }, [call.room, isSharingScreen]);

  const handleLeave = useCallback(() => {
    leavingRef.current = true;
    call.leave();
  }, [call]);

  const handleBackToDashboard = useCallback(() => {
    // Explicit "minimize and go back" affordance — same as navigating away
    router.push('/dashboard');
  }, [router]);

  if (call.connecting) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <p>Connecting to session...</p>
      </div>
    );
  }

  if (call.error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-4">
        <p className="text-red-400">{call.error}</p>
        <button onClick={() => router.push('/dashboard/telehealth')} className="px-4 py-2 bg-blue-600 rounded">
          Back
        </button>
      </div>
    );
  }

  if (!call.room) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <p>Connecting to session...</p>
      </div>
    );
  }

  const totalTiles = call.participants.length + 1;
  const gridCols =
    totalTiles <= 1 ? 'grid-cols-1' : totalTiles <= 4 ? 'grid-cols-2' : totalTiles <= 9 ? 'grid-cols-3' : 'grid-cols-4';

  const isLocalHost = !!call.localIdentity && call.localIdentity.id === call.hostUserId;

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <button onClick={handleBackToDashboard} className="text-xs text-gray-300 hover:text-white">
          ← Back to Dashboard (call stays connected)
        </button>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 grid ${gridCols} gap-2 p-2 overflow-auto`}>
          <div
            ref={call.attachLocalVideo}
            className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          >
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
              <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                You{call.localIdentity?.role ? ` · ${ROLE_LABELS[call.localIdentity.role] ?? call.localIdentity.role}` : ''}
              </span>
              {isLocalHost && (
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-semibold">Host</span>
              )}
            </div>
            {networkQuality !== null && (
              <span className="absolute top-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">
                Signal: {networkQuality}/5
              </span>
            )}
          </div>
          {call.participants.map((participant) => (
            <ParticipantTile key={participant.sid} participant={participant} isHost={parseIdentity(participant.identity).id === call.hostUserId} />
          ))}
        </div>

        {chatOpen && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700 text-white font-semibold text-sm">Session Chat</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && <p className="text-gray-500 text-xs text-center mt-4">No messages yet</p>}
              {chatMessages.map((m) => (
                <div key={m.id}>
                  <p className="text-xs text-gray-400">
                    {m.sender_name}{m.sender_role ? ` · ${ROLE_LABELS[m.sender_role] ?? m.sender_role}` : ''}
                  </p>
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
        <button
          onClick={call.toggleMic}
          className={`px-4 py-3 rounded-full ${call.micEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}
        >
          {call.micEnabled ? 'Mute' : 'Unmute'}
        </button>
        <button
          onClick={call.toggleCamera}
          className={`px-4 py-3 rounded-full ${call.cameraEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}
        >
          {call.cameraEnabled ? 'Camera Off' : 'Camera On'}
        </button>
        <button
          onClick={toggleScreenShare}
          className={`px-4 py-3 rounded-full ${isSharingScreen ? 'bg-blue-600' : 'bg-gray-700'} text-white`}
        >
          {isSharingScreen ? 'Stop Sharing' : 'Share Screen'}
        </button>
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`px-4 py-3 rounded-full ${chatOpen ? 'bg-blue-600' : 'bg-gray-700'} text-white`}
        >
          Chat
        </button>
        <button onClick={handleLeave} className="px-6 py-3 rounded-full bg-red-600 text-white font-semibold">
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
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
          {identity.name}{identity.role ? ` · ${ROLE_LABELS[identity.role] ?? identity.role}` : ''}
        </span>
        {isHost && <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-semibold">Host</span>}
      </div>
    </div>
  );
}
