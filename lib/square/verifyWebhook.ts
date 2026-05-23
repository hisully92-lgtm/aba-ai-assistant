import crypto from "crypto";

export function verifySquareWebhook({
  body,
  signature,
  signatureKey,
}: {
  body: string;
  signature: string;
  signatureKey: string;
}) {
  const hash = crypto
    .createHmac("sha256", signatureKey)
    .update(body)
    .digest("base64");

  return hash === signature;
}