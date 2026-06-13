"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

const PWA_URL = "https://aba-ai-assistant.com/dashboard/pwa";

export default function PWAPage() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [browser, setBrowser] = useState("");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "">("");
  const [isOnline, setIsOnline] = useState(true);
  const [swRegistered, setSwRegistered] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    const androidDevice = /android/.test(ua);
    setIsIOS(iosDevice);
    setIsAndroid(androidDevice);

    if (ua.includes("edg")) setBrowser("Edge");
    else if (ua.includes("chrome")) setBrowser("Chrome");
    else if (ua.includes("safari")) setBrowser("Safari");
    else if (ua.includes("firefox")) setBrowser("Firefox");
    else setBrowser("Browser");

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }

    setIsOnline(navigator.onLine);
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        setSwRegistered(!!reg);
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
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

  function handleCopy() {
    navigator.clipboard.writeText(PWA_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const platform = isIOS ? "ios" : isAndroid ? "android" : "desktop";
  const isFullyInstalled = isInstalled || installed;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Install ABA AI App" />

      {/* ONLINE STATUS */}
      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border ${isOnline ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
        <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
        {isOnline ? "You are online" : "You are offline — core features still work"}
        {swRegistered && <span className="ml-auto text-gray-400">Service Worker active ✓</span>}
      </div>

      {/* STATUS */}
      {isFullyInstalled ? (
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

      {/* ONE-CLICK INSTALL */}
      {installPrompt && !installed && (
        <Section title="One-Click Install">
          <p className="text-sm text-gray-600 mb-4">Your browser supports automatic installation. Click below to install ABA AI.</p>
          <Button onClick={handleInstall} className="w-full text-base py-3">
            📲 Install ABA AI Now
          </Button>
        </Section>
      )}

      {/* QR CODE — shown on desktop so staff can scan with phone */}
      {platform === "desktop" && (
        <Section title="📱 Install on Your Phone">
          <p className="text-sm text-gray-600 mb-4">
            Scan this QR code with your phone camera to open the install page on your device.
            Works for both <strong>iPhone</strong> and <strong>Android</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="border-2 border-gray-200 rounded-2xl p-4 bg-white">
                <QRCodeSVG
                  value={PWA_URL}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#1e3a5f"
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="text-xs text-gray-400 text-center">Scan with your phone camera</p>
            </div>
            <div className="flex-1 space-y-3">
              <div className="border border-blue-100 rounded-xl p-4 bg-blue-50">
                <p className="text-xs font-bold text-blue-700 mb-2">📱 iPhone / iPad</p>
                <p className="text-xs text-blue-600">Scan → Opens in Safari → Tap Share → Add to Home Screen</p>
              </div>
              <div className="border border-green-100 rounded-xl p-4 bg-green-50">
                <p className="text-xs font-bold text-green-700 mb-2">🤖 Android</p>
                <p className="text-xs text-green-600">Scan → Opens in Chrome → Tap menu → Add to Home Screen</p>
              </div>
              <div className="border border-gray-100 rounded-xl p-3 bg-white">
                <p className="text-xs text-gray-500 mb-1">Or share the link directly:</p>
                <div className="flex items-center gap-2">
                  <input type="text" readOnly value={PWA_URL}
                    className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-gray-50 text-gray-600 focus:outline-none" />
                  <button onClick={handleCopy}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* IOS INSTRUCTIONS */}
      {platform === "ios" && !isFullyInstalled && (
        <Section title="📱 Install on iPhone / iPad">
          <div className="space-y-3">
            {[
              { step: "1", icon: "🌐", text: "Open this page in Safari (not Chrome or Firefox)" },
              { step: "2", icon: "⬆️", text: "Tap the Share button at the bottom of your screen" },
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
            ⚠️ Must use Safari on iOS. Chrome and Firefox on iOS do not support Add to Home Screen.
          </div>
        </Section>
      )}

      {/* ANDROID INSTRUCTIONS */}
      {platform === "android" && !installPrompt && !isFullyInstalled && (
        <Section title="📱 Install on Android">
          <div className="space-y-3">
            {[
              { step: "1", icon: "🌐", text: "Open this page in Chrome" },
              { step: "2", icon: "⋮", text: "Tap the three-dot menu in the top right corner" },
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

      {/* DESKTOP INSTALL */}
      {platform === "desktop" && !installPrompt && !isFullyInstalled && (
        <Section title="💻 Install on Desktop">
          <div className="space-y-3">
            {(browser === "Chrome" || browser === "Edge") ? (
              [
                { step: "1", icon: "🌐", text: `Open this page in ${browser}` },
                { step: "2", icon: "📥", text: "Look for the install icon (⊕) in the address bar on the right" },
                { step: "3", icon: "📲", text: "Click \"Install\" in the popup" },
                { step: "4", icon: "🖥️", text: "ABA AI will open as a standalone desktop app" },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-4 border border-gray-100 rounded-xl p-4 bg-white">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                    {item.step}
                  </div>
                  <span className="text-2xl">{item.icon}</span>
                  <p className="text-sm text-gray-700">{item.text}</p>
                </div>
              ))
            ) : (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                For the best install experience, open ABA AI in <strong>Chrome</strong> or <strong>Edge</strong> on desktop.
              </div>
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
          <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-xl p-3">
            <span className="text-xl">✅</span>
            <span className="text-sm font-medium">Notifications enabled</span>
          </div>
        ) : notifPermission === "denied" ? (
          <div className="space-y-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600 font-medium">❌ Notifications blocked</p>
            <p className="text-xs text-gray-500">Go to browser settings → Site permissions → Notifications → Allow for aba-ai-assistant.com</p>
          </div>
        ) : (
          <Button onClick={requestNotifications}>🔔 Enable Notifications</Button>
        )}
      </Section>

      {/* FEATURES */}
      <Section title="✨ Why Install the App?">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { icon: "⚡", title: "Instant Launch", desc: "Opens in under 1 second from home screen" },
            { icon: "📵", title: "Works Offline", desc: "Core features work without internet" },
            { icon: "🔔", title: "Push Alerts", desc: "Session reminders and auth expiry warnings" },
            { icon: "📱", title: "Native Feel", desc: "Full screen — no browser address bar" },
            { icon: "🔒", title: "Secure", desc: "HTTPS encrypted, HIPAA compliant" },
            { icon: "🔄", title: "Auto Updates", desc: "Always has the latest version automatically" },
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