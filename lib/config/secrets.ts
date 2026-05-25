// =========================
// SECRET REGISTRY
// =========================

type SecretConfig = {
  key: string;
  required: boolean;
  description: string;
  rotationDays: number;
};

export const SECRET_REGISTRY: SecretConfig[] = [
  // AI
  { key: "ANTHROPIC_API_KEY", required: true, description: "Anthropic Claude API", rotationDays: 90 },
  { key: "OPENAI_API_KEY", required: false, description: "OpenAI API (legacy)", rotationDays: 90 },

  // Supabase
  { key: "NEXT_PUBLIC_SUPABASE_URL", required: true, description: "Supabase project URL", rotationDays: 365 },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, description: "Supabase anon key", rotationDays: 90 },
  { key: "SUPABASE_SERVICE_ROLE_KEY", required: true, description: "Supabase service role (admin)", rotationDays: 90 },

  // Square
  { key: "SQUARE_ACCESS_TOKEN", required: true, description: "Square payments access token", rotationDays: 90 },
  { key: "SQUARE_WEBHOOK_SIGNATURE_KEY", required: true, description: "Square webhook signature", rotationDays: 90 },
  { key: "SQUARE_LOCATION_ID", required: true, description: "Square location ID", rotationDays: 365 },

  // Upstash
  { key: "UPSTASH_REDIS_REST_URL", required: true, description: "Upstash Redis URL", rotationDays: 180 },
  { key: "UPSTASH_REDIS_REST_TOKEN", required: true, description: "Upstash Redis token", rotationDays: 90 },

  // Email
  { key: "RESEND_API_KEY", required: true, description: "Resend email API", rotationDays: 90 },
  { key: "ALERT_EMAIL", required: true, description: "Alert recipient email", rotationDays: 365 },

  // Internal
  { key: "WORKER_SECRET", required: true, description: "Internal worker auth secret", rotationDays: 30 },
];

// =========================
// VALIDATE ON STARTUP
// =========================

export function validateSecrets(): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const secret of SECRET_REGISTRY) {
    const value = process.env[secret.key];

    if (!value) {
      if (secret.required) {
        missing.push(secret.key);
      } else {
        warnings.push(`Optional secret missing: ${secret.key} (${secret.description})`);
      }
    }
  }

  if (missing.length > 0) {
    console.error("[secrets] Missing required secrets:", missing);
  }

  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn("[secrets]", w));
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

// =========================
// ROTATION SCHEDULE
// =========================

export function getRotationSchedule(): {
  key: string;
  description: string;
  rotateDaysInterval: number;
}[] {
  return SECRET_REGISTRY
    .filter((s) => s.required)
    .sort((a, b) => a.rotationDays - b.rotationDays)
    .map((s) => ({
      key: s.key,
      description: s.description,
      rotateDaysInterval: s.rotationDays,
    }));
}