type ExportItem = {
  id: string;
  client_id: string;
  created_at: string;
  status: "pending" | "approved" | "rejected";
};

export function calculateExportRisk(item: ExportItem, index: number) {
  // 🧠 MOCK LOGIC (will later become AI-driven)

  if (item.status === "pending" && index % 2 === 0) {
    return "high";
  }

  if (item.status === "rejected") {
    return "medium";
  }

  return "low";
}