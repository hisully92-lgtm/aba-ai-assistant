import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Share a Suggestion — ABA AI Assistant",
  description:
    "Help shape the future of ABA AI Assistant. Submit feature requests, bug reports, and ideas directly to our product team.",
  openGraph: {
    title: "Share a Suggestion — ABA AI Assistant",
    url: "https://aba-ai-assistant.com/suggestions",
  },
};

export default function SuggestionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}