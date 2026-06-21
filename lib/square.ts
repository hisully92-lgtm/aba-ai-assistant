const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN!;
const BASE_URL =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

const PLAN_PRICES: Record<string, Record<number, number>> = {
  starter:      { 1: 14900, 3: 14100, 6: 13400, 9: 12700, 12: 11900 },
  professional: { 1: 29900, 3: 28400, 6: 26900, 9: 25400, 12: 23900 },
  growth:       { 1: 39900, 3: 37900, 6: 35900, 9: 33900, 12: 31900 },
  enterprise:   { 1: 54900, 3: 52100, 6: 49400, 9: 46700, 12: 43900 },
  clinic:       { 1: 69900, 3: 66400, 6: 62900, 9: 59400, 12: 55900 },
};

export async function createSquarePaymentLink(
  userId: string,
  planType: string = "professional",
  months: number = 1,
  redirectUrl: string = ""
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
        redirect_url: redirectUrl,
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







