const isProd = process.env.NODE_ENV === "production";

if (isProd && !process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY");
}

if (isProd && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

if (isProd && !process.env.SQUARE_ACCESS_TOKEN) {
  throw new Error("Missing SQUARE_ACCESS_TOKEN");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;