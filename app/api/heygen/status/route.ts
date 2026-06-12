import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const supabase = getClient();
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("video_id");
  const trainingVideoId = searchParams.get("training_video_id");

  if (!videoId || !trainingVideoId) {
    return NextResponse.json({ error: "Missing video_id or training_video_id" }, { status: 400 });
  }

  try {
    // Check HeyGen status
    const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY!,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    const status = data.data?.status;
    const videoUrl = data.data?.video_url;
    const thumbnailUrl = data.data?.thumbnail_url;
    const duration = data.data?.duration;

    // Update job status in DB
    await supabase.from("heygen_video_jobs")
      .update({
        status: status ?? "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("heygen_video_id", videoId);

    // If completed — download and upload to Supabase Storage
    if (status === "completed" && videoUrl) {
      // Download video from HeyGen
      const videoResponse = await fetch(videoUrl);
      const videoBuffer = await videoResponse.arrayBuffer();
      const videoBlob = new Uint8Array(videoBuffer);

      // Upload to Supabase Storage
      const storagePath = `training/${trainingVideoId}/video.mp4`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("training-videos")
        .upload(storagePath, videoBlob, {
          contentType: "video/mp4",
          upsert: true,
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("training-videos")
          .getPublicUrl(storagePath);

        // Update training video with URL and duration
        await supabase.from("training_videos").update({
          video_url: urlData.publicUrl,
          duration_seconds: duration ? Math.round(duration) : 0,
          is_published: true,
          heygen_status: "completed",
          ai_generated: true,
        }).eq("id", trainingVideoId);

        // Update job
        await supabase.from("heygen_video_jobs").update({
          status: "completed",
          updated_at: new Date().toISOString(),
        }).eq("heygen_video_id", videoId);

        return NextResponse.json({
          status: "completed",
          video_url: urlData.publicUrl,
          thumbnail_url: thumbnailUrl,
          duration,
        });
      }
    }

    if (status === "failed") {
      await supabase.from("training_videos").update({
        heygen_status: "failed",
      }).eq("id", trainingVideoId);

      await supabase.from("heygen_video_jobs").update({
        status: "failed",
        error_message: data.data?.error ?? "Generation failed",
        updated_at: new Date().toISOString(),
      }).eq("heygen_video_id", videoId);
    }

    return NextResponse.json({
      status: status ?? "pending",
      video_url: videoUrl ?? null,
      thumbnail_url: thumbnailUrl ?? null,
      duration: duration ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Server error" }, { status: 500 });
  }
}