'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Video, { Room, RemoteParticipant, RemoteTrack } from 'twilio-video';

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
      <div className="flex items-center justify-center gap-4 p-4 bg-gray-800">
        <button onClick={toggleMic} className={`px-4 py-3 rounded-full ${micEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}>
          {micEnabled ? 'Mute' : 'Unmute'}
        </button>
        <button onClick={toggleCamera} className={`px-4 py-3 rounded-full ${cameraEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}>
          {cameraEnabled ? 'Camera Off' : 'Camera On'}
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
        {participant.identity}
      </span>
    </div>
  );
}
