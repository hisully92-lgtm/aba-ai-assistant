'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Video, { Room, RemoteParticipant, RemoteTrack } from 'twilio-video';

export default function TelehealthRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomName = params.roomName as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let activeRoom: Room | null = null;

    async function connectToRoom() {
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
          body: JSON.stringify({ roomName }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to get video token');
        }

        const { token } = await res.json();

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

        activeRoom.on('disconnected', () => {
          router.push('/dashboard/telehealth');
        });
      } catch (err: any) {
        console.error('Failed to connect to room:', err);
        setError(err.message || 'Failed to connect');
        setConnecting(false);
      }
    }

    connectToRoom();

    return () => {
      if (activeRoom) {
        activeRoom.disconnect();
      }
    };
  }, [roomName, router]);

  const toggleMic = useCallback(() => {
    if (!room) return;
    room.localParticipant.audioTracks.forEach((pub) => {
      if (micEnabled) {
        pub.track.disable();
      } else {
        pub.track.enable();
      }
    });
    setMicEnabled(!micEnabled);
  }, [room, micEnabled]);

  const toggleCamera = useCallback(() => {
    if (!room) return;
    room.localParticipant.videoTracks.forEach((pub) => {
      if (cameraEnabled) {
        pub.track.disable();
      } else {
        pub.track.enable();
      }
    });
    setCameraEnabled(!cameraEnabled);
  }, [room, cameraEnabled]);

  const leaveCall = useCallback(() => {
    room?.disconnect();
    router.push('/dashboard/telehealth');
  }, [room, router]);

  if (connecting) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <p>Connecting to session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-4">
        <p className="text-red-400">{error}</p>
        <button onClick={() => router.push('/dashboard/telehealth')} className="px-4 py-2 bg-blue-600 rounded">
          Back
        </button>
      </div>
    );
  }

  const totalTiles = participants.length + 1;
  const gridCols =
    totalTiles <= 1 ? 'grid-cols-1' : totalTiles <= 2 ? 'grid-cols-2' : totalTiles <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="flex flex-col h-screen bg-gray-900">
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
        <button
          onClick={toggleMic}
          className={`px-4 py-3 rounded-full ${micEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}
        >
          {micEnabled ? 'Mute' : 'Unmute'}
        </button>
        <button
          onClick={toggleCamera}
          className={`px-4 py-3 rounded-full ${cameraEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}
        >
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
        const el = track.attach();
        container.appendChild(el);
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
