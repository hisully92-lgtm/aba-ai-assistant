import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { triggerType, companyId, data } = await req.json();

    if (!triggerType || !companyId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get template for this company and trigger type
    const { data: template } = await supabaseAdmin
      .from("sms_templates")
      .select("*")
      .eq("company_id", companyId)
      .eq("trigger_type", triggerType)
      .eq("enabled", true)
      .maybeSingle();

    if (!template) {
      return NextResponse.json({ queued: 0, reason: "No active template found" });
    }

    // Build message from template
    let message = template.message_template
      .replace("{client_name}", data.client_name ?? "your client")
      .replace("{date}", data.date ?? "")
      .replace("{time}", data.time ?? "")
      .replace("{clinician}", data.clinician ?? "your clinician")
      .replace("{clinic_name}", data.clinic_name ?? "your clinic")
      .replace("{days_remaining}", String(data.days_remaining ?? ""));

    // Determine recipients
    let phoneNumbers: string[] = [];

    if (data.to_phone) {
      phoneNumbers = [data.to_phone];
    } else {
      // Send to all admins
      const { data: admins } = await supabaseAdmin
        .from("company_users")
        .select("user_id")
        .eq("company_id", companyId)
        .eq("role", "admin")
        .eq("status", "active");

      if (admins) {
        const userIds = admins.map((a: any) => a.user_id);
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("phone")
          .in("id", userIds)
          .not("phone", "is", null);
        phoneNumbers = (profiles ?? []).map((p: any) => p.phone).filter(Boolean);
      }
    }

    let queued = 0;
    for (const phone of phoneNumbers) {
      await supabaseAdmin.from("sms_queue").insert({
        company_id: companyId,
        to_number: phone,
        message,
        trigger_type: triggerType,
        scheduled_for: new Date().toISOString(),
      });
      queued++;
    }

    return NextResponse.json({ queued });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
