// =========================
// ⏱ TRACK TIMING
// =========================

export function startTimer() {
  const start = performance.now();

  return {
    stop(): number {
      return Math.round(performance.now() - start);
    },
  };
}