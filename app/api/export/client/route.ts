import { NextResponse } from "next/server";
import { buildClientExport } from "@/lib/exports/buildClientExport";

export async function POST(req: Request) {
  const { clientId } = await req.json();

  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const exportData = await buildClientExport(clientId);

  return NextResponse.json(exportData);
}