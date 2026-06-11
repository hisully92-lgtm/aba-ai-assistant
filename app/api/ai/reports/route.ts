import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generateAnalyticsPDF, AnalyticsReportData } from "@/lib/reports/generateAnalyticsPDF";
import { saveClinicalReport } from "@/lib/reports/saveClinicalReport";

export async function POST(req: NextRequest) {
  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }

    // 1. Fetch client
    const { data: client, error: clientError } = await supabaseAdmin
  .from("clients")
  .select("id, full_name")
  .eq("id", client_id)
  .single() as any;

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // 2. Fetch risk scores
    const { data: risk } = await supabaseAdmin
  .from("client_risk")
  .select("risk_score, forecast_score, risk_level")
  .eq("client_id", client_id)
  .single() as any;

    // 3. Fetch export stats
    const { data: exports } = await supabaseAdmin
      .from("client_exports")
      .select("id, status")
      .eq("client_id", client_id);

    const totalExports = exports?.length ?? 0;
    const approvedExports = exports?.filter((e: { id: string; status: string }) => e.status === "approved").length ?? 0;
    const rejectedExports = exports?.filter((e: { id: string; status: string }) => e.status === "rejected").length ?? 0;
    const pendingExports = exports?.filter((e: { id: string; status: string }) => e.status === "pending").length ?? 0;

    // 4. Fetch recent sessions
    const { data: sessions } = await supabaseAdmin
      .from("sessions")
      .select("created_at, status, notes")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(5);

    // 5. Build report data
    const reportDate = new Date().toISOString().split("T")[0];

    const reportData: AnalyticsReportData = {
      clientName: client.full_name,
      reportDate,
      riskLevel: (risk?.risk_level as "low" | "medium" | "high" | "unknown") ?? "unknown",
      riskScore: risk?.risk_score ?? null,
      forecastScore: risk?.forecast_score ?? null,
      totalExports,
      approvedExports,
      rejectedExports,
      pendingExports,
      recentSessions: (sessions ?? []).map((s: { created_at: string; status: string; notes?: string }) => ({
        date: s.created_at,
        status: s.status,
        notes: s.notes,
      })),
    };

    // 6. Generate PDF blob
    const pdfBlob = generateAnalyticsPDF(reportData);

    // 7. Save record to clinical_reports
    const reportText = [
      `Client: ${reportData.clientName}`,
      `Risk Level: ${reportData.riskLevel}`,
      `Risk Score: ${reportData.riskScore ?? "N/A"}`,
      `Forecast Score: ${reportData.forecastScore ?? "N/A"}`,
      `Total Exports: ${totalExports}`,
      `Approval Rate: ${totalExports ? Math.round((approvedExports / totalExports) * 100) : 0}%`,
    ].join("\n");

    await saveClinicalReport({
      clientId: client_id,
      reportDate,
      reportText,
      summaryText: `Analytics report generated for ${reportData.clientName} on ${reportDate}`,
    });

    // 8. Return PDF
    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${client_id}-${reportDate}.pdf"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Report generation failed";
    console.error("Report generation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}