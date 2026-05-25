import type { AIRequest, AIResponse } from "@/types/ai";

async function request(payload: AIRequest): Promise<AIResponse> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        error: data?.error || "AI request failed",
      };
    }

    return data;
  } catch (err: any) {
    return {
      error: err?.message || "Unknown error",
    };
  }
}

// =========================
// 🧠 SDK LAYER (FINAL)
// =========================

export const aiClient = {
  note(payload: Omit<AIRequest & { type: "note" }, "type">) {
    return request({ type: "note", ...payload });
  },

  summary(payload: Omit<AIRequest & { type: "summary" }, "type">) {
    return request({ type: "summary", ...payload });
  },

  timeline(payload: Omit<AIRequest & { type: "timeline" }, "type">) {
    return request({ type: "timeline", ...payload });
  },

  report(payload: Omit<AIRequest & { type: "report" }, "type">) {
    return request({ type: "report", ...payload });
  },
};