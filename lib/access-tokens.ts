import crypto from "crypto";

const SECRET = process.env.ACCESS_TOKEN_SECRET!; // add a long random string to your env vars

export function signToken(payload: string): string {
  const hmac = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${hmac}`).toString("base64url");
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [payload, hmac] = decoded.split(".");
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    if (hmac !== expected) return null;
    return payload;
  } catch {
    return null;
  }
}