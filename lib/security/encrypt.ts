import crypto from "crypto";

// =========================
// ENV VALIDATION
// =========================
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not defined`);
  }
  return value;
}

const SECRET_KEY = requireEnv("ENCRYPTION_KEY");

// =========================
// KEY DERIVATION (32 bytes)
// =========================
function getKey(): Buffer {
  return crypto.createHash("sha256").update(SECRET_KEY, "utf8").digest();
}

// =========================
// TYPES
// =========================
type EncryptedPayload = {
  iv: string;
  data: string;
  tag: string;
};

// =========================
// ENCRYPT
// =========================
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const key = getKey();

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    iv: iv.toString("hex"),
    data: encrypted.toString("hex"),
    tag: tag.toString("hex"),
  };

  return JSON.stringify(payload);
}

// =========================
// DECRYPT
// =========================
export function decrypt(payload: string): string {
  let parsed: EncryptedPayload;

  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("Invalid encrypted payload (not JSON)");
  }

  const { iv, data, tag } = parsed;

  if (!iv || !data || !tag) {
    throw new Error("Invalid encrypted payload format");
  }

  const key = getKey();

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// =========================
// SAFE DECRYPT (PHI WRAPPER)
// =========================
export function safeDecrypt(val: any): string {
  try {
    return decrypt(val);
  } catch {
    return val;
  }
}