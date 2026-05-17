function generateInsight(behaviorCount: number) {
  if (behaviorCount > 10) {
    return "High frequency behavior detected. Review intervention plan.";
  }

  if (behaviorCount === 0) {
    return "No occurrences recorded. Possible skill acquisition progress.";
  }

  return "Behavior within expected range.";
}