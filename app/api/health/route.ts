import { NextResponse } from "next/server";
import { validateSecrets } from "@/lib/config/secrets";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const { valid, missing, warnings } = validateSecrets();

    return NextResponse.json({
      status: valid ? "healthy" : "degraded",
      secrets: {
        valid,
        missing,
        warnings,
      },
      timestamp: new Date().toISOString(),
    }, { status: valid ? 200 : 500 });

  } catch (err: unknown) {
    const { error, status } = toErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}