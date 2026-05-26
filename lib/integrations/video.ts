export async function createVideoRoom(
  sessionId: string,
  clientName?: string,
  durationMinutes?: number
): Promise<{ url: string; roomName: string; token?: string; scaffold?: boolean }> {
  try {
    const res = await fetch("/api/video/create-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        clientName,
        duration: (durationMinutes ?? 60) * 60,
      }),
    });

    const data = await res.json();

    if (data.scaffold) {
      console.log("[VIDEO] Scaffold mode:", data.message);
      return { url: data.room_url, roomName: data.room_name, scaffold: true };
    }

    return { url: data.room_url, roomName: data.room_name, token: data.token };
  } catch (err) {
    console.error("[VIDEO] Error:", err);
    return { url: "", roomName: "" };
  }
}

export async function getVideoRoomUrl(
  sessionId: string,
  clientName?: string
): Promise<string> {
  const room = await createVideoRoom(sessionId, clientName);
  return room.url;
}