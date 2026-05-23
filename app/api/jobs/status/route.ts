import { NextResponse } from "next/server";
import { getJob } from "@/lib/queue";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("id");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const job = getJob(jobId);

  return NextResponse.json({ job });
}