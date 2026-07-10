import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "@/lib/access-tokens";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/request-access/error`);

  const payload = verifyToken(token);
  if (!payload) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/request-access/error`);

  const [requestId, plan] = payload.split(":");

  const { data: request } = await supabaseAdmin
    .from("access_requests")
    .update({ selected_plan: plan, status: "plan_selected" })
    .eq("id", requestId)
    .select()
    .single();

  if (!request) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/request-access/error`);

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/request-access/confirm?token=${token}`);
}
