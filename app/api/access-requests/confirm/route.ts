import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGeneralEmail } from "@/lib/email";
import { verifyToken } from "@/lib/access-tokens";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { token, notes } = await req.json();
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid link" }, { status: 400 });

  const [requestId] = payload.split(":");

  const { data: request, error } = await supabaseAdmin
    .from("access_requests")
    .update({ notes, status: "submitted_for_review" })
    .eq("id", requestId)
    .select()
    .single();

  if (error) {
    console.error("Confirm route DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 400 });

  await sendGeneralEmail({
    to: "hello@aba-ai-assistant.com",
    subject: "New clinic request: " + request.org_name + " (" + request.selected_plan + ")",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>${request.org_name}</h2>
        <p><b>Contact:</b> ${request.contact_name} - ${request.contact_email}</p>
        <p><b>${request.verification_type.toUpperCase()}:</b> ${request.verification_value}</p>
        <p><b>Selected plan:</b> ${request.selected_plan}</p>
        ${notes ? `<p><b>Notes from clinic:</b><br/>${notes.replace(/\n/g, "<br/>")}</p>` : ""}
        <p style="color:#666;font-size:13px;margin-top:20px;">Reach out to confirm and walk through setup.</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}
