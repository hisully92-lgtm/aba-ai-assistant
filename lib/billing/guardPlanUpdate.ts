export function assertWebhookSource(source: string) {
  if (source !== "square_webhook") {
    throw new Error("Unauthorized plan update attempt");
  }
}