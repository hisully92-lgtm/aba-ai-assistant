import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPushToUsers } from "@/lib/push-server";

type NotifyBody = {
  kind: "team" | "group" | "channel";
  clientId?: string;
  groupId?: string;
  channel?: "students" | "supervisors";
  companyId?: string;
  message: string;
  url: string;
};

function truncate(text: string, max = 100) {
  return text.length > max ? text.slice(0, max - 1) + "..." : text;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const sender = userData?.user;
    if (userError || !sender) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: NotifyBody = await req.json();
    const { kind, clientId, groupId, channel, companyId, message, url } = body;
    if (!message || !url) {
      return NextResponse.json({ error: "Missing message or url" }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", sender.id)
      .single();
    const senderName = profile?.full_name ?? "Someone";

    let recipientIds: string[] = [];

    if (kind === "team" && clientId) {
      const { data: assignments } = await supabaseAdmin
        .from("client_assignments")
        .select("user_id")
        .eq("client_id", clientId);
      recipientIds = (assignments ?? []).map((a: any) => a.user_id);
    } else if (kind === "group" && groupId) {
      const { data: members } = await supabaseAdmin
        .from("group_chat_members")
        .select("user_id")
        .eq("group_chat_id", groupId);
      recipientIds = (members ?? []).map((m: any) => m.user_id);
    } else if (kind === "channel" && companyId && channel) {
      const targetRoles =
        channel === "students"
          ? ["student_analyst"]
          : ["bcba", "admin", "clinical_director", "supervisor"];
      const { data: companyUsers } = await supabaseAdmin
        .from("company_users")
        .select("user_id, role")
        .eq("company_id", companyId)
        .eq("status", "active")
        .in("role", targetRoles);
      recipientIds = (companyUsers ?? []).map((c: any) => c.user_id);
    }

    recipientIds = Array.from(new Set(recipientIds)).filter((id) => id !== sender.id);
    if (recipientIds.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    await sendPushToUsers(recipientIds, {
      title: `New message from ${senderName}`,
      body: truncate(message),
      url,
    });

    return NextResponse.json({ success: true, sent: recipientIds.length });
  } catch (err: any) {
    console.error("notify-chat error:", err);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
