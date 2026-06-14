import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — ABA AI Assistant | Plans from $99/mo",
  description:
    "Simple flat-rate pricing for ABA therapy clinics. Starter at $99/mo, Professional at $199/mo. No per-user fees. 30-day free trial. HIPAA compliant.",
  openGraph: {
    title: "ABA AI Assistant Pricing — Starting at $99/mo",
    description: "Flat-rate clinic pricing — save 50-70% vs per-user competitors. 30-day free trial included.",
    url: "https://aba-ai-assistant.com/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}