export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  type?: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body, type }),
    });
    const data = await res.json();
    if (data.scaffold) {
      console.log("[EMAIL] Scaffold mode:", data.message);
      return false;
    }
    return data.success ?? false;
  } catch (err) {
    console.error("[EMAIL] Error:", err);
    return false;
  }
}

export async function sendWelcomeEmail(to: string, name: string): Promise<boolean> {
  return sendEmail(
    to,
    "Welcome to ABA AI Assistant!",
    `<h2>Welcome, ${name}! 👋</h2>
     <p>Your ABA AI Assistant account is ready. Here's how to get started:</p>
     <ol>
       <li>Add your first client under <strong>Clients / Learners</strong></li>
       <li>Set up your insurance authorizations</li>
       <li>Start logging session data</li>
     </ol>
     <p>If you need help, visit your dashboard and click <strong>Help</strong>.</p>`,
    "welcome"
  );
}

export async function sendAuthExpiryEmail(
  to: string,
  clientName: string,
  provider: string,
  expiryDate: string,
  daysLeft: number
): Promise<boolean> {
  return sendEmail(
    to,
    `⚠️ Authorization Expiring Soon — ${clientName}`,
    `<h2>Authorization Expiry Alert</h2>
     <p>This is a reminder that the following authorization is expiring soon:</p>
     <ul>
       <li><strong>Client:</strong> ${clientName}</li>
       <li><strong>Insurance:</strong> ${provider}</li>
       <li><strong>Expiry Date:</strong> ${expiryDate}</li>
       <li><strong>Days Remaining:</strong> ${daysLeft}</li>
     </ul>
     <p>Please submit a re-authorization request as soon as possible to avoid service interruption.</p>
     <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/authorizations" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
       Manage Authorizations →
     </a>`,
    "auth_expiry"
  );
}

export async function sendContractRenewalEmail(
  to: string,
  name: string,
  planName: string,
  renewalDate: string,
  daysLeft: number,
  autoRenew: boolean
): Promise<boolean> {
  return sendEmail(
    to,
    `📋 Your ABA AI ${planName} Plan Renews in ${daysLeft} Days`,
    `<h2>Subscription Renewal Reminder</h2>
     <p>Hi ${name},</p>
     <p>Your <strong>${planName}</strong> plan is set to renew on <strong>${renewalDate}</strong> (${daysLeft} days from now).</p>
     ${autoRenew
       ? `<p>✅ <strong>Auto-renew is ON</strong> — your plan will renew automatically. No action needed.</p>`
       : `<p>⚠️ <strong>Auto-renew is OFF</strong> — please log in to renew your plan before it expires.</p>`
     }
     <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/settings/billing" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
       Manage Subscription →
     </a>`,
    "contract_renewal"
  );
}

export async function sendProgressReportEmail(
  to: string,
  guardianName: string,
  clientName: string,
  reportHtml: string
): Promise<boolean> {
  return sendEmail(
    to,
    `📊 Progress Report — ${clientName}`,
    `<h2>Progress Report for ${clientName}</h2>
     <p>Dear ${guardianName},</p>
     <p>Please find below the latest progress report for ${clientName}:</p>
     <hr/>
     ${reportHtml}
     <hr/>
     <p>Log in to your parent portal to view graphs and detailed data.</p>`,
    "progress_report"
  );
}

export async function sendSessionReminderEmail(
  to: string,
  guardianName: string,
  clientName: string,
  date: string,
  time: string,
  therapistName: string,
  isVirtual: boolean
): Promise<boolean> {
  return sendEmail(
    to,
    `📅 Session Reminder — ${clientName} — ${date}`,
    `<h2>Upcoming Session Reminder</h2>
     <p>Hi ${guardianName},</p>
     <p>This is a reminder about an upcoming ABA therapy session:</p>
     <ul>
       <li><strong>Client:</strong> ${clientName}</li>
       <li><strong>Date:</strong> ${date}</li>
       <li><strong>Time:</strong> ${time}</li>
       <li><strong>Therapist:</strong> ${therapistName}</li>
       <li><strong>Type:</strong> ${isVirtual ? "Telehealth (Virtual)" : "In-Person"}</li>
     </ul>`,
    "session_reminder"
  );
}