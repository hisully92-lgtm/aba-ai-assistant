import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  console.log("FULL URL:", req.url);
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  console.log("AUTH CONFIRM HIT:", { code, token_hash, type });

  // Pass code to client-side loading page for PKCE exchange
  if (code) {
    return NextResponse.redirect(new URL(`/auth/loading?code=${code}`, req.url));
  }

  if (token_hash && type) {
    return NextResponse.redirect(new URL(`/auth/loading?token_hash=${token_hash}&type=${type}`, req.url));
  }

  // No params — try loading page anyway (session may already be set)
  return NextResponse.redirect(new URL("/auth/loading", req.url));
}