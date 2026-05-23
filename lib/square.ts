import { Client, Environment } from "square";

export const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
});

export async function createSquarePaymentLink(userId: string) {
  const response =
    await squareClient.checkoutApi.createPaymentLink({
      idempotencyKey: `${userId}-${Date.now()}`,

      order: {
        locationId: process.env.SQUARE_LOCATION_ID!,
        referenceId: userId,

        lineItems: [
          {
            name: "Pro Plan",
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(2000),
              currency: "USD",
            },
          },
        ],
      },
    });

  return response.result;
}