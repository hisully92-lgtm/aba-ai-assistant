import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [avatarRes, voiceRes] = await Promise.all([
      fetch("https://api.heygen.com/v2/avatars", {
        headers: {
          "X-Api-Key": process.env.HEYGEN_API_KEY!,
          "Content-Type": "application/json",
        },
      }),
      fetch("https://api.heygen.com/v2/voices", {
        headers: {
          "X-Api-Key": process.env.HEYGEN_API_KEY!,
          "Content-Type": "application/json",
        },
      }),
    ]);

    const avatarData = await avatarRes.json();
    const voiceData = await voiceRes.json();

    return NextResponse.json({
      avatars: avatarData.data?.avatars ?? [],
      voices: voiceData.data?.voices ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch HeyGen assets" }, { status: 500 });
  }
}