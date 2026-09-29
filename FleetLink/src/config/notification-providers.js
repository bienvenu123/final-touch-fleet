const { sendReportEmail } = require("./mailer");
const {
  registerNotificationAdapter,
  createEmailAdapter,
  createSmsAdapter,
  createPushAdapter,
} = require("../services/notification-adapters.service");

function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && (process.env.SMTP_FROM || process.env.SMTP_USER));
}

function isTwilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

async function sendTwilioSms({ to, message }) {
  if (!isTwilioConfigured()) throw new Error("Twilio SMS is not configured");
  if (!/^\+\d{8,15}$/.test(to || "")) throw new Error("SMS recipients must use E.164 format");

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
  return { channel: "sms", messageId: result.sid, status: result.status };
}

async function sendExpoPushNotification({ token, title, body, payload }) {
  if (!ExponentPushToken(token)) throw new Error("Push recipient must be a valid Expo push token");
  const headers = { Accept: "application/json", "Content-Type": "application/json" };
  if (process.env.EXPO_PUSH_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}`;

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers,
    body: JSON.stringify({ to: token, title: title || "FleetLink", body, data: payload || {} }),
  });
  if (!response.ok) throw new Error(`Expo push failed: ${await response.text()}`);
  const result = await response.json();
  const ticket = result?.data?.[0];
  if (!ticket || ticket.status === "error") throw new Error(ticket?.message || "Expo push was rejected");
  return { channel: "push", messageId: ticket.id || null, status: ticket.status };
}

function ExponentPushToken(value) {
  return typeof value === "string" && /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(value);
}

function registerConfiguredNotificationAdapters() {
  const registered = [];
  if (isEmailConfigured()) {
    registerNotificationAdapter("EMAIL", createEmailAdapter(sendReportEmail));
    registered.push("EMAIL");
  }
  if (isTwilioConfigured()) {
    registerNotificationAdapter("SMS", createSmsAdapter(sendTwilioSms));
    registered.push("SMS");
  }
  // Expo's service does not require a server credential for basic delivery.
  // The adapter validates the recipient token before making a network request.
  registerNotificationAdapter("PUSH", createPushAdapter(sendExpoPushNotification));
  registered.push("PUSH");
  return registered;
}

module.exports = {
  isEmailConfigured,
  isTwilioConfigured,
  sendTwilioSms,
  sendExpoPushNotification,
  registerConfiguredNotificationAdapters,
};
