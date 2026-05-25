import { supabaseAdmin } from "@/lib/supabase/server";
import { decrypt, encrypt } from "@/lib/security/encrypt";
import { reEncryptValue } from "@/lib/security/rotateSecret";

const PHI_FIELDS = [
  "behaviors_observed",
  "interventions_used",
  "client_response",
  "programs_targeted",
  "staff_member",
  "notes",
] as const;

type PHIField = (typeof PHI_FIELDS)[number];

type SessionRow = {
  id: string;
} & Record<PHIField, string | null>;

// =========================
// RE-ENCRYPT ALL SESSIONS
// =========================
export async function reEncryptSessions() {
  console.log("[reEncryptSessions] Starting re-encryption...");

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("id, " + PHI_FIELDS.join(", "));

  if (error) throw new Error(`Failed to fetch sessions: ${error.message}`);

  const sessions = data as unknown as SessionRow[];

  if (!sessions?.length) {
    console.log("[reEncryptSessions] No sessions found.");
    return;
  }

  let success = 0;
  let failed = 0;

  for (const session of sessions) {
    try {
      const updates: Partial<Record<PHIField, string | null>> = {};

      for (const field of PHI_FIELDS) {
        const value = session[field];
        if (value) {
          updates[field] = reEncryptValue({
            oldDecrypt: decrypt,
            newEncrypt: encrypt,
            value,
          });
        }
      }

      await supabaseAdmin
        .from("sessions")
        .update(updates)
        .eq("id", session.id);

      success++;
    } catch (err) {
      console.error(
        `[reEncryptSessions] Failed for session ${session.id}:`,
        err
      );
      failed++;
    }
  }

  console.log(
    `[reEncryptSessions] Done. Success: ${success}, Failed: ${failed}`
  );
}