import type { Metadata } from "next";
import GoogleAnalytics from "@/components/GoogleAnalytics";

import { Inter } from "next/font/google";
// @ts-ignore: allow side-effect CSS import without type declarations
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  manifest: "/manifest.json",
  title: {
    default: "ABA AI Assistant — ABA Therapy Documentation Platform",
    template: "%s | ABA AI Assistant",
  },
  description: "ABA AI Assistant helps RBTs, BCBAs, and clinic admins write session notes, track goals, manage authorizations, and generate progress reports. HIPAA compliant. Start free.",
  keywords: [
    "ABA therapy software", "ABA documentation", "RBT session notes",
    "BCBA practice management", "ABA billing software", "behavior tracking",
    "autism therapy software", "ABA clinic management", "HIPAA compliant ABA",
    "session notes software", "progress reports ABA", "ABA data collection",
  ],
  authors: [{ name: "ABA AI Assistant" }],
  creator: "ABA AI Assistant",
  publisher: "ABA AI Assistant",
  metadataBase: new URL("https://aba-ai-assistant.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://aba-ai-assistant.com",
    siteName: "ABA AI Assistant",
    title: "ABA AI Assistant — ABA Therapy Documentation Made Simple",
    description: "Write session notes, track goals, manage authorizations, and generate progress reports. Built for RBTs, BCBAs, and clinic admins. HIPAA compliant. Start free.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ABA AI Assistant — ABA Therapy Documentation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ABA AI Assistant — ABA Therapy Documentation Made Simple",
    description: "Write session notes, track goals, manage authorizations, and generate progress reports. HIPAA compliant.",
    images: ["/og-image.png"],
  },
  
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ABA AI",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
    shortcut: "/icon-192.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
                <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ABA AI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) {
                      console.log('SW registered:', reg.scope);
                    })
                    .catch(function(err) {
                      console.log('SW registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <GoogleAnalytics />
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}





