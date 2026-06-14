import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — ABA AI Assistant",
  description:
    "Sign in to your ABA AI Assistant account. HIPAA-compliant ABA therapy documentation platform for RBTs, BCBAs, and clinic administrators.",
  openGraph: {
    title: "Sign In to ABA AI Assistant",
    description: "Access your ABA therapy documentation platform.",
    url: "https://aba-ai-assistant.com/login",
  },
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}