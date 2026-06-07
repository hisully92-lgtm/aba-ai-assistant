import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSquarePaymentLink } from "@/lib/square";
import { rateLimit } from "@/lib/rate-limit";

function extractIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

export async function POST(req: Request) {
  const ip = extractIp(req);

  try {
    const ipAllowed = await rateLimit(`checkout:ip:${ip}`, 10, 60 * 60_000);
    if (!ipAllowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userAllowed = await rateLimit(`checkout:user:${user.id}`, 5, 60 * 60_000);
    if (!userAllowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { plan, months } = body;

    if (!plan) {
      return NextResponse.json({ error: "Missing plan" }, { status: 400 });
    }

    const result = await createSquarePaymentLink(user.id, plan, months ?? 1);
    const url = result?.paymentLink?.url ?? result?.payment_link?.url;

    if (!url) {
      return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
    }

    return NextResponse.json({ url });

  } catch (err: any) {
    console.error("Checkout failed:", err);
    return NextResponse.json({ error: "Checkout creation failed" }, { status: 500 });
  }
}