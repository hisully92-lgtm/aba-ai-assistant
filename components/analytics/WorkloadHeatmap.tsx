"use client";

export type TherapistLoad = {
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

function calculateLoadScore(item: TherapistLoad): number {
  const breakdown = item.riskBreakdown;
  if (!breakdown) return item.clients;
  return breakdown.low * 1 + breakdown.medium * 2 + breakdown.high * 3;
}

function getHeatColor(score: number): string {
  if (score >= 30) return "bg-red-950";
  if (score >= 20) return "bg-red-600";
  if (score >= 10) return "bg-amber-400";
  return "bg-green-600";
}

export default function WorkloadHeatmap({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-lg font-bold mb-4">Therapist Workload Heatmap</h2>
        <p className="text-gray-400 text-sm">No session data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h2 className="text-lg font-bold mb-4">Therapist Workload Heatmap</h2>

      <div className="grid gap-3">
        {data.map((item) => {
          const loadScore = calculateLoadScore(item);
          const isOverloaded = loadScore >= 25;

          return (
            <div
              key={item.therapist}
              className={`${getHeatColor(loadScore)} text-white font-semibold rounded-lg px-4 py-3 flex justify-between items-center`}
            >
              <div>
                <p className="text-sm">{item.therapist}</p>
                <p className="text-xs opacity-90 mt-0.5">
                  Clients: {item.clients} | Load Score: {loadScore}
                  {item.riskBreakdown && (
                    <span className="ml-2">
                      (L:{item.riskBreakdown.low} M:{item.riskBreakdown.medium} H:{item.riskBreakdown.high})
                    </span>
                  )}
                </p>
              </div>

              {isOverloaded && (
                <span className="bg-black/20 text-xs px-2 py-1 rounded-md">
                  ⚠ Overloaded
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}