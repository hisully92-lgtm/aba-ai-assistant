import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { toErrorResponse } from "@/lib/errors";

export async function GET(req: Request) {
  try {
    // AUTH — this endpoint can return AI-generated session note text (PHI),
    // so it must require a valid logged-in user, not be open to anyone who
    // guesses or intercepts a jobId.
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
