import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest-app.json",
};

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}