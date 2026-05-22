"use client";

export default function UpgradeButton() {
  async function handleUpgrade() {
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      body: JSON.stringify({
        priceId: "price_xxx_replace_me",
      }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
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