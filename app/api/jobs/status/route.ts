import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { toErrorResponse } from "@/lib/errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("id");

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .select("id, type, status, result, error, attempts, created_at, updated_at")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });

  } catch (err: unknown) {
    const { error, status } = toErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}