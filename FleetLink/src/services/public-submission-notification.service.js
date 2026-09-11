const { sendReportEmail } = require("../config/mailer");

function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && (process.env.SMTP_FROM || process.env.SMTP_USER));
}

function isTwilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

async function sendSms(to, message) {
  if (!isTwilioConfigured()) return { channel: "sms", status: "not_configured" };
  if (!/^\+\d{8,15}$/.test(to)) return { channel: "sms", status: "invalid_phone" };

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const form = new URLSearchParams({ To: to, From: process.env.TWILIO_PHONE_NUMBER, Body: message });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!response.ok) throw new Error(`Twilio SMS failed: ${await response.text()}`);
  const result = await response.json();
  return { channel: "sms", status: "sent", messageId: result.sid };
}

async function sendPublicSubmissionConfirmation({ type, name, email, phone }) {
  const isBooking = type === "booking";
  const label = isBooking ? "booking request" : "contact message";
  const subject = isBooking ? "FleetLink booking request received" : "FleetLink message received";
  const greeting = name ? `Hi ${name},` : "Hello,";
  const text = `${greeting}\n\nWe have received your ${label}. Our FleetLink team will review it and contact you shortly.\n\nThank you,\nFleetLink`;
  const outcomes = [];

  if (isEmailConfigured()) {
    try { outcomes.push({ channel: "email", status: "sent", ...(await sendReportEmail({ to: email, subject, text })) }); }
    catch (error) { outcomes.push({ channel: "email", status: "failed", error: error.message }); }
  } else outcomes.push({ channel: "email", status: "not_configured" });

  try { outcomes.push(await sendSms(phone, `FleetLink: We received your ${label} and will contact you shortly.`)); }
  catch (error) { outcomes.push({ channel: "sms", status: "failed", error: error.message }); }

  const failed = outcomes.filter(outcome => outcome.status === "failed");
  if (failed.length) console.error("Public submission confirmation delivery failed", { type, failed });
  return outcomes;
}

module.exports = { sendPublicSubmissionConfirmation };
