type RequiredEnvKey =
  | "OPENAI_API_KEY"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SQUARE_ACCESS_TOKEN"
  | "SQUARE_WEBHOOK_SIGNATURE_KEY";

/**
 * Safely get an environment variable at runtime.
 * Use ONLY in server-side code.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

/**
 * Strict startup validation (manual use only).
 * Useful for debugging or health checks.
 */
export function validateRequiredEnv(): void {
  const requiredEnv: RequiredEnvKey[] = [
    "OPENAI_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SQUARE_ACCESS_TOKEN",
    "SQUARE_WEBHOOK_SIGNATURE_KEY",
  ];

  const missing: string[] = [];

  for (const key of requiredEnv) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(", ")}`
    );
  }
}