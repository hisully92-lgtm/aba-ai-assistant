import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchLogsForExport, convertToCSV, type ComplianceExportType } from "@/lib/compliance/exportLogs";
import { requireRole } from "@/lib/auth/requireRole";
import { toErrorResponse } from "@/lib/errors";
import { logAudit } from "@/lib/observability/logAudit";

export async function POST(req: NextRequest) {
  try {
    // AUTH
    const { data: auth } = await supabaseAdmin.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ROLE CHECK — admin only
    await requireRole(user.id, "admin");

    // PARSE
    const { type, from, to } = await req.json();

    if (!type || !from || !to) {
      return NextResponse.json({ error: "Missing type, from, or to" }, { status: 400 });
    }

    // FETCH
    const data = await fetchLogsForExport(type as ComplianceExportType, { from, to });

    // CONVERT TO CSV
    const csv = convertToCSV(data);

    // AUDIT LOG
    await logAudit({
      userId: user.id,
      action: "compliance.export",
      resource: `${type}_logs`,
      metadata: { from, to, recordCount: data.length },
    });

    const filename = `${type}-logs-${from}-to-${to}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (err: unknown) {
    const { error, status } = toErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}