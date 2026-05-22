import { useEffect, useState } from "react";
import { generateWeeklySummary } from "@/lib/ai/generateWeeklySummary";

const [summary, setSummary] = useState<string | null>(null);

useEffect(() => {
  if (!exportsData || exportsData.length === 0) return;

  async function buildSummary() {
    try {
      const result = await generateWeeklySummary(exportsData);
      setSummary(result);
    } catch (error) {
      console.error("Weekly summary error:", error);
      setSummary("Unable to generate summary.");
    }
  }

  buildSummary();
}, [exportsData]);