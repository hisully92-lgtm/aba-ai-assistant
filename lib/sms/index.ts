// =========================
// SMS NOTIFICATION SCAFFOLD
// =========================
// To enable SMS notifications:
// 1. Create a Twilio account at twilio.com
// 2. Add to .env.local:
//    TWILIO_ACCOUNT_SID=your_account_sid
//    TWILIO_AUTH_TOKEN=your_auth_token
//    TWILIO_PHONE_NUMBER=+1234567890
// 3. Install: npm install twilio
// 4. Uncomment server-side code below

export type SMSPayload = {
  to: string;
  message: string;
};

// CLIENT-SIDE: send via API route
export async function sendSMS(payload: SMSPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return res.ok ? { success: true } : { success: false, error: data.error };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "SMS failed" };
  }
}