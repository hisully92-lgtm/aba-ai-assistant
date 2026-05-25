const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN!;
const BASE_URL =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

export async function createSquarePaymentLink(userId: string) {
  const res = await fetch(`${BASE_URL}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),

      quick_pay: {
        name: "Pro Plan",
        price_money: {
          amount: 2000,
          currency: "USD",
        },
        location_id: process.env.SQUARE_LOCATION_ID,
      },

      checkout_options: {
        redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?success=true`,
      },

      metadata: {
        userId, // 👈 ONLY SOURCE OF USER LINKING
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}