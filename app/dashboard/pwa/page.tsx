"use client";

import { useEffect, useState } from "react";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

export default function PWAPage() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | "unknown">("unknown");

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setPlatform("ios");
    else if (/android/i.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    });

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setIsInstallable(false);
    });
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Install App">
        <p className="text-gray-500 text-sm">Install ABA AI on your device for the best experience.</p>
      </PageHeader>

      {isInstalled ? (
        <Section title="✅ App Installed">
          <p className="text-green-700 text-sm">ABA AI is installed on your device. You can open it from your home screen or app launcher.</p>
        </Section>
      ) : (
        <>
          {/* INSTALL BUTTON */}
          {isInstallable && (
            <Section title="Install ABA AI">
              <p className="text-gray-600 text-sm mb-4">Install ABA AI as an app on your device for faster access and offline capabilities.</p>
              <Button onClick={handleInstall}>📱 Install App</Button>
            </Section>
          )}

          {/* iOS INSTRUCTIONS */}
          {platform === "ios" && (
            <Section title="Install on iPhone / iPad">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">To install ABA AI on your iOS device:</p>
                <div className="space-y-3">
                  {[
                    { step: "1", text: "Open this page in Safari (not Chrome or Firefox)" },
                    { step: "2", text: "Tap the Share button at the bottom of the screen (□↑)" },
                    { step: "3", text: "Scroll down and tap 'Add to Home Screen'" },
                    { step: "4", text: "Tap 'Add' in the top right corner" },
                    { step: "5", text: "ABA AI will appear on your home screen!" },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3 items-start">
                      <span className="w-7 h-7 bg-blue-600 text-white rounded-full text-sm font-bold flex items-center justify-center shrink-0">
                        {item.step}
                      </span>
                      <p className="text-sm text-gray-700 pt-1">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* ANDROID INSTRUCTIONS */}
          {platform === "android" && (
            <Section title="Install on Android">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">To install ABA AI on your Android device:</p>
                <div className="space-y-3">
                  {[
                    { step: "1", text: "Open this page in Chrome" },
                    { step: "2", text: "Tap the 3-dot menu in the top right" },
                    { step: "3", text: "Tap 'Add to Home screen'" },
                    { step: "4", text: "Tap 'Add' to confirm" },
                    { step: "5", text: "ABA AI will appear on your home screen!" },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3 items-start">
                      <span className="w-7 h-7 bg-blue-600 text-white rounded-full text-sm font-bold flex items-center justify-center shrink-0">
                        {item.step}
                      </span>
                      <p className="text-sm text-gray-700 pt-1">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* DESKTOP INSTRUCTIONS */}
          {platform === "desktop" && !isInstallable && (
            <Section title="Install on Desktop">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">To install ABA AI on your computer:</p>
                <div className="space-y-3">
                  {[
                    { step: "1", text: "Open this page in Chrome or Edge" },
                    { step: "2", text: "Look for the install icon (⊕) in the address bar" },
                    { step: "3", text: "Click 'Install'" },
                    { step: "4", text: "ABA AI will open as a standalone app!" },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3 items-start">
                      <span className="w-7 h-7 bg-blue-600 text-white rounded-full text-sm font-bold flex items-center justify-center shrink-0">
                        {item.step}
                      </span>
                      <p className="text-sm text-gray-700 pt-1">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}
        </>
      )}

      {/* BENEFITS */}
      <Section title="Why Install the App?">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: "⚡", title: "Faster Access", desc: "Open directly from home screen — no browser needed" },
            { icon: "📱", title: "Mobile Optimized", desc: "Full-screen experience designed for tablets and phones" },
            { icon: "🔔", title: "Push Notifications", desc: "Receive alerts for pings, reminders, and messages" },
            { icon: "🔒", title: "Secure", desc: "Same security as the web — HIPAA-compliant" },
          ].map((item) => (
            <div key={item.title} className="border border-gray-100 rounded-xl p-4 bg-white">
              <p className="text-2xl mb-2">{item.icon}</p>
              <p className="font-medium text-gray-800">{item.title}</p>
              <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}