type Props = {
  data: {
    risk: "low" | "medium" | "high";
  }[];
};

export default function RiskAnalyticsPanel({ data }: Props) {
  const counts = {
    low: 0,
    medium: 0,
    high: 0,
  };

  data.forEach((d) => {
    counts[d.risk]++;
  });

  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 12,
        background: "#fafafa",
      }}
    >
      <h2 style={{ marginBottom: 12 }}>
        Risk Distribution Overview
      </h2>

      <p>🟢 Low: {counts.low}</p>
      <p>🟡 Medium: {counts.medium}</p>
      <p>🔴 High: {counts.high}</p>
    </div>
  );
}