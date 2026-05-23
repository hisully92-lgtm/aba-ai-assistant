const requiredEnv = [
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_WEBHOOK_SIGNATURE_KEY",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing env variable: ${key}`);
  }
}