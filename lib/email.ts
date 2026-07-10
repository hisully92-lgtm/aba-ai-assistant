import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_SENDER_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendLocationConfirmationEmail({
  adminEmail,
  adminName,
  clinicName,
  locationName,
  locationAddress,
}: {
  adminEmail: string;
  adminName: string;
  clinicName: string;
  locationName: string;
  locationAddress: string;
}) {
  try {
    await transporter.sendMail({
      from: "ABA AI Assistant <noreply@aba-ai-assistant.com>",
      to: adminEmail,
      subject: "New Location Added - " + locationName,
      encoding: "utf-8",
      headers: { "Content-Type": "text/html; charset=UTF-8" },
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a2234;">New Location Confirmed</h2>
          <p>Hi ${adminName},</p>
          <p>Your payment has been confirmed by Square and your new location is now active.</p>
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Clinic:</strong> ${clinicName}</p>
            <p style="margin: 8px 0 0;"><strong>New Location:</strong> ${locationName}</p>
            <p style="margin: 8px 0 0;"><strong>Address:</strong> ${locationAddress}</p>
          </div>
          <p>You can manage your locations and assign staff at any time from your Admin Panel.</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 32px;">
            ABA AI Assistant - aba-ai-assistant.com<br/>
            This is an automated confirmation email.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Email send error:", err);
  }
}

export async function sendGeneralEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    await transporter.sendMail({
      from: "ABA AI Assistant <noreply@aba-ai-assistant.com>",
      to,
      subject,
      encoding: "utf-8",
      headers: { "Content-Type": "text/html; charset=UTF-8" },
      html,
    });
  } catch (err) {
    console.error("Email send error:", err);
  }
}
