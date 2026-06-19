const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN!;
const BASE_URL =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

const PLAN_PRICES: Record<string, Record<number, number>> = {
  starter:      { 1: 5900,  3: 5600,  6: 5300,  9: 5100,  12: 4900 },
  professional: { 1: 11900, 3: 11300, 6: 10700, 9: 10300, 12: 9900 },
  clinic:       { 1: 23900, 3: 22700, 6: 21500, 9: 20700, 12: 19900 },
};

export async function createSquarePaymentLink(
  userId: string,
  planType: string = "professional",
  months: number = 1
) {
  const planPrices = PLAN_PRICES[planType] ?? PLAN_PRICES.professional;
  const pricePerMonth = planPrices[months] ?? planPrices[1];
  const totalAmount = pricePerMonth * months;

  const planLabels: Record<string, string> = {
    starter: "Starter Plan",
    professional: "Professional Plan",
    clinic: "Clinic Plan",
  };

  const contractLabel = months === 1 ? "Monthly" : `${months}-Month Contract`;

  const res = await fetch(`${BASE_URL}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      quick_pay: {
        name: `${planLabels[planType] ?? "ABA AI Plan"} â€” ${contractLabel}`,
        price_money: {
          amount: totalAmount,
          currency: "USD",
        },
        location_id: process.env.SQUARE_LOCATION_ID,
      },
      checkout_options: {
        redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings/billing?success=true`,
      },
      metadata: {
        userId,
        planType,
        months: String(months),
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Square API error:", JSON.stringify(data));
    throw new Error(JSON.stringify(data));
  }

  console.log("Square API success:", JSON.stringify(data));
  return data;
}
