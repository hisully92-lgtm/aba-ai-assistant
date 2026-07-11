import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Self-serve checkout has been discontinued. Please use the Request Upgrade option in your dashboard." },
    { status: 403 }
  );
}
