import crypto from "crypto";

const SECRET = process.env.ENCRYPTION_KEY!;

export function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(SECRET),
    iv
  );

  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(data: string) {
  const [iv, encrypted] = data.split(":");

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(SECRET),
    Buffer.from(iv, "hex")
  );

  let decrypted = decipher.update(Buffer.from(encrypted, "hex"));
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}