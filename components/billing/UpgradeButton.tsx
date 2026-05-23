"use client";

export default function UpgradeButton() {
  async function handleUpgrade() {
    const res = await fetch("/api/checkout", {
      method: "POST",
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.message);
    }
  }

  return (
    <button
      onClick={handleUpgrade}
      className="px-4 py-2 bg-black text-white rounded-lg"
    >
      Upgrade to Pro
    </button>
  );
}