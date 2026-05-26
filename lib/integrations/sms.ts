export async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message }),
    });
    const data = await res.json();
    if (data.scaffold) {
      console.log("[SMS] Scaffold mode:", data.message);
      return false;
    }
    return data.success ?? false;
  } catch (err) {
    console.error("[SMS] Error:", err);
    return false;
  }
}

export async function sendAppointmentReminder(
  to: string,
  clientName: string,
  date: string,
  time: string,
  therapistName: string
): Promise<boolean> {
  const message = `Hi! This is a reminder that ${clientName} has an ABA therapy session on ${date} at ${time} with ${therapistName}. Reply STOP to unsubscribe.`;
  return sendSMS(to, message);
}

export async function sendAuthExpiryAlert(
  to: string,
  clientName: string,
  provider: string,
  expiryDate: string,
  daysLeft: number
): Promise<boolean> {
  const message = `⚠️ Authorization Alert: ${clientName}'s ${provider} authorization expires in ${daysLeft} days (${expiryDate}). Please submit re-authorization. - ABA AI`;
  return sendSMS(to, message);
}

export async function sendContractRenewalReminder(
  to: string,
  planName: string,
  renewalDate: string,
  daysLeft: number
): Promise<boolean> {
  const message = `📋 ABA AI Reminder: Your ${planName} plan renews in ${daysLeft} days on ${renewalDate}. Log in to manage your subscription. - ABA AI Assistant`;
  return sendSMS(to, message);
}