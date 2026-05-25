import crypto from "crypto";

// =========================
// SECRET ROTATION UTILITY
// =========================

/**
 * Generates a new secret key — use this when rotating ENCRYPTION_KEY or WORKER_SECRET.
 * Copy the output into your .env.local and Vercel environment variables.
 */
export function generateSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Rotation checklist — follow these steps when rotating a secret:
 *
 * ENCRYPTION_KEY rotation:
 * 1. Generate a new key using generateSecret()
 * 2. Add NEW_ENCRYPTION_KEY to .env.local alongside existing ENCRYPTION_KEY
 * 3. Run re-encryption migration (re-encrypt all PHI fields with new key)
 * 4. Replace ENCRYPTION_KEY with NEW_ENCRYPTION_KEY in .env.local
 * 5. Remove NEW_ENCRYPTION_KEY from .env.local
 * 6. Deploy
 *
 * WORKER_SECRET rotation:
 * 1. Generate a new key using generateSecret()
 * 2. Update WORKER_SECRET in .env.local and Vercel
 * 3. Update any cron jobs or external services calling /api/queue/worker
 * 4. Deploy
 */

type ReEncryptOptions = {
  oldDecrypt: (val: string) => string;
  newEncrypt: (val: string) => string;
  value: string;
};

/**
 * Re-encrypts a single value from old key to new key.
 * Use during ENCRYPTION_KEY rotation migration.
 */
export function reEncryptValue({
  oldDecrypt,
  newEncrypt,
  value,
}: ReEncryptOptions): string {
  try {
    const decrypted = oldDecrypt(value);
    return newEncrypt(decrypted);
  } catch {
    // If decryption fails, value may not be encrypted — return as-is
    return value;
  }
}