import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function POST() {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    message: "Stripe disabled — Square integration coming soon",
    userId: user.id,
  });
}