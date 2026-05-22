"use client";

type ExportWithRisk = {
  risk: "low" | "medium" | "high";
};

type TherapistLoad = {
  therapist: string;
  clients: number;
  riskBreakdown?: {
    low: number;
    medium: number;
    high: number;
  };
};

type Props = {
  data: TherapistLoad[];
};

function calculateLoadScore(item: TherapistLoad) {
  const breakdown = item.riskBreakdown;

  if (!breakdown) {
    // fallback (your current system)
    return item.clients;
  }

  return (
    breakdown.low * 1 +
    breakdown.medium * 2 +
    breakdown.high * 3
  );
}

function getHeatColor(score: number) {
  if (score >= 30) return "#7f1d1d"; // deep red (critical)
  if (score >= 20) return "#dc2626"; // red
  if (score >= 10) return "#f59e0b"; // amber
  return "#16a34a"; // green
}

export default function WorkloadHeatmap({ data }: Props) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h2 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>
        📊 Therapist Workload Heatmap
      </h2>

      <div style={{ display: "grid", gap: 12 }}>
        {data.map((item) => {
          const loadScore = calculateLoadScore(item);
          const color = getHeatColor(loadScore);

          const isOverloaded = loadScore >= 25;

          return (
            <div
              key={item.therapist}
              style={{
                padding: 14,
                borderRadius: 10,
                background: color,
                color: "white",
                fontWeight: 700,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 14 }}>
                  {item.therapist}
                </div>

                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  Clients: {item.clients} | Load Score: {loadScore}
                </div>
              </div>

              {isOverloaded && (
                <div
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  ⚠ Overloaded
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}