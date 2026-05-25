import { encrypt, safeDecrypt } from "@/lib/security/encrypt";

// =========================
// PHI FIELDS
// =========================
const PHI_FIELDS = [
  "behaviors_observed",
  "interventions_used",
  "client_response",
  "programs_targeted",
  "staff_member",
  "notes",
] as const;

type PHIField = (typeof PHI_FIELDS)[number];

type RawSession = Partial<Record<PHIField, string | null>>;
type EncryptedSession = Partial<Record<PHIField, string | null>>;
type DecryptedSession = Partial<Record<PHIField, string | null>>;

// =========================
// ENCRYPT SESSION FIELDS
// =========================
export function encryptSessionFields(data: RawSession): EncryptedSession {
  const result: EncryptedSession = {};

  for (const field of PHI_FIELDS) {
    const value = data[field];
    if (value) {
      try {
        result[field] = encrypt(value);
      } catch {
        result[field] = value;
      }
    } else {
      result[field] = value ?? null;
    }
  }

  return result;
}

// =========================
// DECRYPT SESSION FIELDS
// =========================
export function decryptSessionFields(data: RawSession): DecryptedSession {
  const result: DecryptedSession = {};

  for (const field of PHI_FIELDS) {
    const value = data[field];
    result[field] = value ? safeDecrypt(value) : null;
  }

  return result;
}