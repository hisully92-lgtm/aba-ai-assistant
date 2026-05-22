"use client";

type ExportWithRisk = {
  risk: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected";
  forecastScore: number;
};

type Props = {
  totalExports: number;
  data: ExportWithRisk[];
};

export default function ClinicPerformanceDashboard({
  totalExports,
  data,
}: Props) {
  const approved = data.filter((d) => d.status === "approved").length;
  const rejected = data.filter((d) => d.status === "rejected").length;

  const highRisk = data.filter((d) => d.risk === "high").length;

  const approvalRate =
    totalExports > 0 ? Math.round((approved / totalExports) * 100) : 0;

  const avgForecast =
    data.length > 0
      ? Math.round(
          data.reduce((sum, d) => sum + d.forecastScore, 0) / data.length
        )
      : 0;

  const efficiencyScore = Math.max(
    0,
    Math.min(100, approvalRate - highRisk * 2)
  );

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        background: "white",
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
        🏥 Clinic Performance Overview
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <Metric label="Total Exports" value={totalExports} />
        <Metric label="Approval Rate" value={`${approvalRate}%`} />
        <Metric label="High Risk Cases" value={highRisk} />
        <Metric label="Avg Forecast Score" value={avgForecast} />
        <Metric label="Efficiency Score" value={`${efficiencyScore}%`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: "#f9fafb",
        border: "1px solid #eee",
      }}
    >
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}