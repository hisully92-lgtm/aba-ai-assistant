import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact ABA AI Assistant — Get in Touch",
  description:
    "Have questions about ABA AI? Request a demo, ask about pricing, or get HIPAA compliance help. We respond within 1-2 business days.",
  openGraph: {
    title: "Contact ABA AI Assistant",
    description: "Request a demo or get help with your ABA therapy documentation platform.",
    url: "https://aba-ai-assistant.com/contact",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}