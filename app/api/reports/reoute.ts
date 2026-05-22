import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  // later: store report, email it, or generate server PDF
  return NextResponse.json({
    success: true,
    message: "Report received",
    data: body,
  });
}