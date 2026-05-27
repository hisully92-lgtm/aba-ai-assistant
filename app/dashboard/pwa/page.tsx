"use client";

import { useEffect, useState } from "react";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

export default function PWAPage() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [browser, setBrowser] = useState("");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "">("");

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    const androidDevice = /android/.test(ua);
    setIsIOS(iosDevice);
    setIsAndroid(androidDevice);
    setIsDesktop(!iosDevice && !androidDevice);

    // Detect browser
    if (ua.includes("chrome")) setBrowser("Chrome");
    else if (ua.includes("safari")) setBrowser("Safari");
    else if (ua.includes("firefox")) setBrowser("Firefox");
    else if (ua.includes("edge")) setBrowser("Edge");
    else setBrowser("Browser");

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Capture install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Check notification permission
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
      setInstallPrompt(null);
    }
  }

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        new Notification("ABA AI Notifications Enabled", {
          body: "You'll now receive session reminders and alerts.",
          icon: "/icon-192.png",
        });
      }
    }
  }

  function openInstructions() {
    if (isIOS) return "ios";
    if (isAndroid) return "android";
    return "desktop";
  }

  const platform = openInstructions();

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Install ABA AI App" />

      {/* STATUS */}
      {isInstalled || installed ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-xl font-bold text-green-700">App Installed!</p>
          <p className="text-sm text-green-600 mt-2">ABA AI is installed on your device and ready to use offline.</p>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
          <p className="text-5xl mb-3">📱</p>
          <p className="text-xl font-bold text-blue-700">Install ABA AI</p>
          <p className="text-sm text-blue-600 mt-2">
            Add ABA AI to your home screen for quick access — works like a native app with offline support.
          </p>
        </div>
      )}

      {/* INSTALL BUTTON — Chrome/Edge/Android */}
      {installPrompt && !installed && (
        <Section title="One-Click Install">
          <p className="text-sm text-gray-600 mb-4">Your browser supports automatic installation. Click below to install ABA AI.</p>
          <Button onClick={handleInstall} className="w-full text-base py-3">
            📲 Install ABA AI Now
          </Button>
        </Section>
      )}

      {/* IOS INSTRUCTIONS */}
      {platform === "ios" && !isInstalled && (
        <Section title="📱 Install on iPhone / iPad (Safari)">
          <div className="space-y-3">
            {[
              { step: "1", icon: "🌐", text: "Open this page in Safari (not Chrome)" },
              { step: "2", icon: "⬆️", text: "Tap the Share button at the bottom of Safari" },
              { step: "3", icon: "➕", text: "Scroll down and tap \"Add to Home Screen\"" },
              { step: "4", icon: "✏️", text: "Name it \"ABA AI\" and tap \"Add\"" },
              { step: "5", icon: "🏠", text: "Find the ABA AI icon on your home screen and tap to launch" },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-4 border border-gray-100 rounded-xl p-4 bg-white">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                  {item.step}
                </div>
                <span className="text-2xl">{item.icon}</span>
                <p className="text-sm text-gray-700">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
            ⚠️ Must use Safari browser on iOS. Chrome and other browsers on iOS do not support Add to Home Screen.
          </div>
        </Section>
      )}

      {/* ANDROID INSTRUCTIONS */}
      {platform === "android" && !installPrompt && !isInstalled && (
        <Section title="📱 Install on Android">
          <div className="space-y-3">
            {[
              { step: "1", icon: "🌐", text: "Open this page in Chrome" },
              { step: "2", icon: "⋮", text: "Tap the three-dot menu in the top right" },
              { step: "3", icon: "➕", text: "Tap \"Add to Home Screen\" or \"Install App\"" },
              { step: "4", icon: "✏️", text: "Confirm by tapping \"Add\" or \"Install\"" },
              { step: "5", icon: "🏠", text: "Find ABA AI on your home screen" },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-4 border border-gray-100 rounded-xl p-4 bg-white">
                <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                  {item.step}
                </div>
                <span className="text-2xl">{item.icon}</span>
                <p className="text-sm text-gray-700">{item.text}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* DESKTOP INSTRUCTIONS */}
      {platform === "desktop" && !installPrompt && !isInstalled && (
        <Section title="💻 Install on Desktop">
          <div className="space-y-3">
            {browser === "Chrome" || browser === "Edge" ? (
              <>
                {[
                  { step: "1", icon: "🌐", text: `Open this page in ${browser}` },
                  { step: "2", icon: "📥", text: "Look for the install icon (⊕) in the address bar on the right" },
                  { step: "3", icon: "📲", text: "Click \"Install\" in the popup" },
                  { step: "4", icon: "🖥️", text: "ABA AI will open as a standalone app" },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-4 border border-gray-100 rounded-xl p-4 bg-white">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                      {item.step}
                    </div>
                    <span className="text-2xl">{item.icon}</span>
                    <p className="text-sm text-gray-700">{item.text}</p>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-gray-600">For the best install experience, open ABA AI in Chrome or Edge on desktop.</p>
            )}
          </div>
        </Section>
      )}

      {/* NOTIFICATIONS */}
      <Section title="🔔 Push Notifications">
        <p className="text-sm text-gray-600 mb-4">
          Enable push notifications to receive session reminders, authorization expiry alerts, and team messages.
        </p>
        {notifPermission === "granted" ? (
          <div className="flex items-center gap-2 text-green-600">
            <span className="text-xl">✅</span>
            <span className="text-sm font-medium">Notifications enabled</span>
          </div>
        ) : notifPermission === "denied" ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600">❌ Notifications blocked. To enable:</p>
            <p className="text-xs text-gray-500">Go to your browser settings → Site permissions → Notifications → Allow for this site</p>
          </div>
        ) : (
          <Button onClick={requestNotifications}>🔔 Enable Notifications</Button>
        )}
      </Section>

      {/* FEATURES */}
      <Section title="✨ App Features">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { icon: "⚡", title: "Fast Launch", desc: "Opens instantly from home screen" },
            { icon: "📵", title: "Offline Ready", desc: "Core features work without internet" },
            { icon: "🔔", title: "Push Alerts", desc: "Session and auth reminders" },
            { icon: "📱", title: "Native Feel", desc: "Full screen, no browser chrome" },
            { icon: "🔒", title: "Secure", desc: "HTTPS encrypted, HIPAA compliant" },
            { icon: "🔄", title: "Auto Updates", desc: "Always has the latest version" },
          ].map((feature) => (
            <div key={feature.title} className="flex items-start gap-3 border border-gray-100 rounded-xl p-3 bg-white">
              <span className="text-2xl">{feature.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{feature.title}</p>
                <p className="text-xs text-gray-500">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}