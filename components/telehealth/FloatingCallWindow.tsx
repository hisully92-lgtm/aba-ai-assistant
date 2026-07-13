'use client';

import { useEffect, useRef, useState } from 'react';
import { useTelehealthCall } from '@/lib/contexts/TelehealthCallContext';
import { RemoteParticipant, RemoteTrack } from 'twilio-video';

function ParticipantVideo({ participant }: { participant: RemoteParticipant }) {
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

    const handleSub = (track: RemoteTrack) => attachTrack(track);
    const handleUnsub = (track: RemoteTrack) => {
      if (track.kind === 'video' || track.kind === 'audio') {
        // @ts-ignore
        track.detach().forEach((el: HTMLElement) => el.remove());
      }
    };

    participant.on('trackSubscribed', handleSub);
    participant.on('trackUnsubscribed', handleUnsub);

    return () => {
      participant.removeAllListeners();
    };
  }, [participant]);

  return <div ref={videoRef} className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />;
}

export default function FloatingCallWindow() {
  const { view, room, participants, micEnabled, cameraEnabled, toggleMic, toggleCamera, expand, leave, attachLocalVideo } =
    useTelehealthCall();

  const [activeIndex, setActiveIndex] = useState(0);
  const [showSelf, setShowSelf] = useState(false);

  useEffect(() => {
    if (activeIndex >= participants.length) setActiveIndex(0);
  }, [participants.length, activeIndex]);

  if (view !== 'floating' || !room) return null;

  const activeParticipant = participants[activeIndex];

  return (
    <div className="fixed bottom-4 right-4 z-50 w-64 bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
      <div className="relative bg-gray-800 aspect-video">
        {showSelf || participants.length === 0 ? (
          <div
            ref={attachLocalVideo}
            className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          />
        ) : (
          <ParticipantVideo key={activeParticipant.sid} participant={activeParticipant} />
        )}

        <span className="absolute bottom-1 left-1 text-white text-[10px] bg-black/50 px-1.5 py-0.5 rounded">
          {showSelf || participants.length === 0
            ? 'You'
            : activeParticipant.identity.split('::')[1]
              ? decodeURIComponent(activeParticipant.identity.split('::')[1])
              : activeParticipant.identity}
        </span>

        <button
          onClick={() => setShowSelf((s) => !s)}
          className="absolute top-1 right-1 text-white text-[10px] bg-black/50 px-1.5 py-0.5 rounded hover:bg-black/70"
        >
          {showSelf ? 'View them' : 'View me'}
        </button>

        {participants.length > 1 && !showSelf && (
          <div className="absolute bottom-1 right-1 flex gap-1">
            {participants.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`w-1.5 h-1.5 rounded-full ${i === activeIndex ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        )}

        {participants.length === 0 && (
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-xs bg-black/50 px-2 py-1 rounded">
            Waiting for others to join...
          </span>
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5 p-2 bg-gray-800">
        <button
          onClick={toggleMic}
          className={`px-2 py-1.5 rounded-full text-xs ${micEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}
        >
          {micEnabled ? 'Mute' : 'Unmute'}
        </button>
        <button
          onClick={toggleCamera}
          className={`px-2 py-1.5 rounded-full text-xs ${cameraEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white`}
        >
          {cameraEnabled ? 'Cam Off' : 'Cam On'}
        </button>
        <button onClick={expand} className="px-2 py-1.5 rounded-full text-xs bg-blue-600 text-white">
          Expand
        </button>
        <button onClick={leave} className="px-2 py-1.5 rounded-full text-xs bg-red-600 text-white font-semibold">
          Leave
        </button>
      </div>
    </div>
  );
}
