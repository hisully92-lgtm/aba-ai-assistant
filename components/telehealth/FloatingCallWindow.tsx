'use client';

import { useTelehealthCall } from '@/lib/contexts/TelehealthCallContext';

export default function FloatingCallWindow() {
  const { view, room, participants, micEnabled, cameraEnabled, toggleMic, toggleCamera, expand, leave, attachLocalVideo } =
    useTelehealthCall();

  if (view !== 'floating' || !room) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-64 bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
      <div
        ref={attachLocalVideo}
        className="relative bg-gray-800 aspect-video [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
      >
        <span className="absolute bottom-1 left-1 text-white text-[10px] bg-black/50 px-1.5 py-0.5 rounded">
          {participants.length > 0 ? `+${participants.length} in call` : 'You'}
        </span>
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
