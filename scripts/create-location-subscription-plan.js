const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const BASE_URL = process.env.SQUARE_ENVIRONMENT === "production"
  ? "https://connect.squareup.com"
  : "https://connect.squareupsandbox.com";

async function run() {
  const res = await fetch(`${BASE_URL}/v2/catalog/object`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      idempotency_key: require("crypto").randomUUID(),
      object: {
        type: "SUBSCRIPTION_PLAN",
        id: "#location-addon-plan",
        subscription_plan_data: {
          name: "Additional Location",
          subscription_plan_variations: [
            {
              type: "SUBSCRIPTION_PLAN_VARIATION",
              id: "#location-addon-variation",
              subscription_plan_variation_data: {
                name: "Additional Location - Monthly",
                phases: [
                  {
                    cadence: "MONTHLY",
                    pricing: {
                      type: "STATIC",
                      price_money: { amount: 4900, currency: "USD" },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    }),
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
