'use client';

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Video, { Room, RemoteParticipant, LocalVideoTrack } from 'twilio-video';

type ParsedIdentity = { id: string; name: string; role: string };

function parseIdentity(identity: string): ParsedIdentity {
  const [id, encodedName, role] = identity.split('::');
  return {
    id: id ?? identity,
    name: encodedName ? decodeURIComponent(encodedName) : identity,
    role: role ?? '',
  };
}

type CallView = 'closed' | 'full' | 'floating';

type TelehealthCallState = {
  view: CallView;
  room: Room | null;
  roomName: string;
  telehealthSessionId: string;
  participants: RemoteParticipant[];
  micEnabled: boolean;
  cameraEnabled: boolean;
  connecting: boolean;
  error: string | null;
  hostUserId: string;
  localIdentity: ParsedIdentity | null;
  connect: (roomName: string, telehealthSessionId: string) => Promise<void>;
  toggleMic: () => void;
  toggleCamera: () => Promise<void>;
  minimize: () => void;
  expand: () => void;
  leave: () => void;
  attachLocalVideo: (el: HTMLDivElement | null) => void;
};

const TelehealthCallContext = createContext<TelehealthCallState | null>(null);

export function useTelehealthCall() {
  const ctx = useContext(TelehealthCallContext);
  if (!ctx) throw new Error('useTelehealthCall must be used within TelehealthCallProvider');
  return ctx;
}

export function TelehealthCallProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [view, setView] = useState<CallView>('closed');
  const [room, setRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [telehealthSessionId, setTelehealthSessionId] = useState('');
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hostUserId, setHostUserId] = useState('');
  const [localIdentity, setLocalIdentity] = useState<ParsedIdentity | null>(null);

  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const localVideoElRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);

  const attachLocalVideo = useCallback((el: HTMLDivElement | null) => {
    localVideoElRef.current = el;
    if (el && localVideoTrackRef.current) {
      el.innerHTML = '';
      el.appendChild(localVideoTrackRef.current.attach());
    }
  }, []);

  const connect = useCallback(async (newRoomName: string, newSessionId: string) => {
    // Already connected to this same room — just make sure it's in full view
    if (roomRef.current && roomName === newRoomName) {
      setView('full');
      return;
    }

    // Switching rooms while already on a call — leave the old one first
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
      setRoom(null);
      setParticipants([]);
    }

    setRoomName(newRoomName);
    setTelehealthSessionId(newSessionId);
    setConnecting(true);
    setError(null);
    setView('full');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        setConnecting(false);
        return;
      }

      const res = await fetch('/api/video/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ roomName: newRoomName, telehealthSessionId: newSessionId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to get video token');
      }

      const { token, hostUserId: host } = await res.json();
      setHostUserId(host ?? '');

      const activeRoom = await Video.connect(token, {
        name: newRoomName,
        audio: true,
        video: { width: 640, height: 480 },
      });

      roomRef.current = activeRoom;
      setLocalIdentity(parseIdentity(activeRoom.localParticipant.identity));
      setRoom(activeRoom);
      setConnecting(false);

      activeRoom.localParticipant.videoTracks.forEach((publication) => {
        if (publication.track) {
          localVideoTrackRef.current = publication.track;
          if (localVideoElRef.current) {
            localVideoElRef.current.innerHTML = '';
            localVideoElRef.current.appendChild(publication.track.attach());
          }
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

      activeRoom.on('disconnected', () => {
        roomRef.current = null;
        setRoom(null);
        setParticipants([]);
        setView('closed');
      });
    } catch (err: any) {
      console.error('Failed to connect to room:', err);
      setError(err.message || 'Failed to connect');
      setConnecting(false);
    }
  }, [roomName]);

  const toggleMic = useCallback(() => {
    if (!roomRef.current) return;
    roomRef.current.localParticipant.audioTracks.forEach((pub) => {
      micEnabled ? pub.track.disable() : pub.track.enable();
    });
    setMicEnabled(!micEnabled);
  }, [micEnabled]);

  const toggleCamera = useCallback(async () => {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;

    if (cameraEnabled) {
      activeRoom.localParticipant.videoTracks.forEach((pub) => pub.track.disable());
      setCameraEnabled(false);
      return;
    }

    const existingTrack = localVideoTrackRef.current;
    const stillPublished = Array.from(activeRoom.localParticipant.videoTracks.values()).some(
      (pub) => pub.track === existingTrack
    );

    if (existingTrack && stillPublished) {
      existingTrack.enable();
      setCameraEnabled(true);
      return;
    }

    try {
      const freshTrack = await Video.createLocalVideoTrack({ width: 640, height: 480 });
      await activeRoom.localParticipant.publishTrack(freshTrack);
      localVideoTrackRef.current = freshTrack;
      if (localVideoElRef.current) {
        localVideoElRef.current.innerHTML = '';
        localVideoElRef.current.appendChild(freshTrack.attach());
      }
      setCameraEnabled(true);
    } catch (err) {
      console.error('Failed to re-acquire camera track:', err);
      setError('Could not turn camera back on — check camera permissions');
    }
  }, [cameraEnabled]);

  const minimize = useCallback(() => {
    setView('floating');
  }, []);

  const expand = useCallback(() => {
    setView('full');
    router.push(`/dashboard/telehealth/room/${roomName}?sessionId=${telehealthSessionId}`);
  }, [router, roomName, telehealthSessionId]);

  const leave = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setRoom(null);
    setParticipants([]);
    setView('closed');
    router.push('/dashboard/telehealth');
  }, [router]);

  return (
    <TelehealthCallContext.Provider
      value={{
        view,
        room,
        roomName,
        telehealthSessionId,
        participants,
        micEnabled,
        cameraEnabled,
        connecting,
        error,
        hostUserId,
        localIdentity,
        connect,
        toggleMic,
        toggleCamera,
        minimize,
        expand,
        leave,
        attachLocalVideo,
      }}
    >
      {children}
    </TelehealthCallContext.Provider>
  );
}
