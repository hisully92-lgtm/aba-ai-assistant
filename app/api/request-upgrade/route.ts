import { NextRequest, NextResponse } from "next/server";
import { sendGeneralEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { companyId, companyName, currentPlan, requestedPlan, resourceType } = await req.json();

  if (!companyId || !requestedPlan) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await sendGeneralEmail({
    to: "hello@aba-ai-assistant.com",
    subject: "Upgrade request: " + (companyName || companyId),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Upgrade Requested</h2>
        <p><b>Company:</b> ${companyName || "Unknown"} (${companyId})</p>
        <p><b>Current plan:</b> ${currentPlan}</p>
        <p><b>Requested plan:</b> ${requestedPlan}</p>
        <p><b>Reason:</b> Hit ${resourceType} limit</p>
        <p style="color:#666;font-size:13px;margin-top:20px;">Reach out to process the upgrade.</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}
