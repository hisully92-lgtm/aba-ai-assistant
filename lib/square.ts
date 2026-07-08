const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN!;
const BASE_URL =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

const PLAN_PRICES: Record<string, Record<number, number>> = {
  starter:      { 1: 19900, 3: 18900, 6: 17900, 9: 16900, 12: 15900 },
  basic:        { 1: 29900, 3: 28400, 6: 26900, 9: 25400, 12: 23900 },
  professional: { 1: 44900, 3: 42700, 6: 40400, 9: 38200, 12: 35900 },
  growth:       { 1: 64900, 3: 61700, 6: 58400, 9: 55200, 12: 51900 },
  enterprise:   { 1: 84900, 3: 80700, 6: 76400, 9: 72200, 12: 67900 },
  clinic:       { 1: 109900, 3: 104400, 6: 98900, 9: 93400, 12: 87900 },
};

export const LOCATION_ADDON_PRICE_CENTS = 4900;

const NONPROFIT_DISCOUNT = 0.20;

type SquareLinkOptions = {
  priceOverrideCents?: number;
  nameOverride?: string;
  extraMetadata?: Record<string, string>;
};

export async function createLocationSubscriptionLink(
  userId: string,
  companyId: string,
  locationPaymentId: string,
  redirectUrl: string
) {
  const res = await fetch(`${BASE_URL}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      checkout_options: {
        subscription_plan_id: process.env.SQUARE_LOCATION_PLAN_VARIATION_ID,
        redirect_url: redirectUrl,
      },
      metadata: {
        userId,
        companyId,
        locationPaymentId,
        paymentType: "location_addon",
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Square subscription checkout error:", JSON.stringify(data));
    throw new Error(JSON.stringify(data));
  }
  console.log("Square subscription checkout success:", JSON.stringify(data));
  return data;
}

export async function createSquarePaymentLink(
  userId: string,
  planType: string = "professional",
  months: number = 1,
  redirectUrl: string = "",
  isNonprofit: boolean = false,
  nonprofitEin: string = "",
  options?: SquareLinkOptions
) {
  const planPrices = PLAN_PRICES[planType] ?? PLAN_PRICES.professional;
  const pricePerMonth = planPrices[months] ?? planPrices[1];
  let totalAmount = options?.priceOverrideCents ?? pricePerMonth * months;

  if (isNonprofit && nonprofitEin && !options?.priceOverrideCents) {
    totalAmount = Math.round(totalAmount * (1 - NONPROFIT_DISCOUNT));
  }

  const planLabels: Record<string, string> = {
    starter: "Starter Plan",
    basic: "Basic Plan",
    professional: "Professional Plan",
    growth: "Growth Plan",
    enterprise: "Enterprise Plan",
    clinic: "Clinic Plan",
  };

  const contractLabel = months === 1 ? "Monthly" : `${months}-Month Contract`;
  const nonprofitLabel = isNonprofit ? " (Nonprofit 20% Discount)" : "";
  const name = options?.nameOverride ?? `${planLabels[planType] ?? "ABA AI Plan"} — ${contractLabel}${nonprofitLabel}`;

  const res = await fetch(`${BASE_URL}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      quick_pay: {
        name,
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
        isNonprofit: String(isNonprofit),
        nonprofitEin,
        ...(options?.extraMetadata ?? {}),
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

