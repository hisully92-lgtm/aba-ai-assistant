import { NextResponse } from "next/server";
import { runMigrations } from "@/lib/migrations";
import { toErrorResponse } from "@/lib/errors";

function isAuthorized(req: Request): boolean {
  const secret = req.headers.get("x-migrate-secret");
  return secret === process.env.WORKER_SECRET;
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runMigrations();

    return NextResponse.json({ success: true, ...result });

  } catch (err: unknown) {
    const { error, status } = toErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}