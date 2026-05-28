import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { script, avatar_id, voice_id, training_video_id, title } = await req.json();

    if (!script || !avatar_id || !voice_id || !training_video_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Submit to HeyGen
    const response = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character: {
              type: "avatar",
              avatar_id,
              avatar_style: "normal",
            },
            voice: {
              type: "text",
              voice_id,
              input_text: script,
              speed: 1.0,
            },
            background: {
              type: "color",
              value: "#1a2234",
            },
          },
        ],
        dimension: {
          width: 1280,
          height: 720,
        },
        test: false,
        caption: false,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json(
        { error: data.message ?? data.error ?? "HeyGen generation failed" },
        { status: 500 }
      );
    }

    const heygenVideoId = data.data?.video_id;

    // Save job to DB
    await supabase.from("heygen_video_jobs").insert([{
      training_video_id,
      heygen_video_id: heygenVideoId,
      status: "pending",
      avatar_id,
      voice_id,
      script,
    }]);

    // Update training video status
    await supabase.from("training_videos").update({
      heygen_video_id: heygenVideoId,
      heygen_status: "processing",
    }).eq("id", training_video_id);

    return NextResponse.json({ video_id: heygenVideoId, status: "processing" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Server error" }, { status: 500 });
  }
}