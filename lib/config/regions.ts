// =========================
// MULTI-REGION CONFIG
// =========================

export type Region = "us-east" | "us-west" | "eu-west" | "ap-southeast";

export const REGION_CONFIG: Record<Region, {
  supabaseUrl: string;
  label: string;
}> = {
  "us-east": {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    label: "US East (Primary)",
  },
  "us-west": {
    supabaseUrl: process.env.SUPABASE_URL_US_WEST ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    label: "US West",
  },
  "eu-west": {
    supabaseUrl: process.env.SUPABASE_URL_EU_WEST ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    label: "EU West",
  },
  "ap-southeast": {
    supabaseUrl: process.env.SUPABASE_URL_AP ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    label: "Asia Pacific",
  },
};

export function getCurrentRegion(): Region {
  return (process.env.NEXT_PUBLIC_REGION as Region) ?? "us-east";
}

export function getRegionLabel(): string {
  return REGION_CONFIG[getCurrentRegion()].label;
}