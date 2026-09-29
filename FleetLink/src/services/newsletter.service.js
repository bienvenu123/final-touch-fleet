const prisma = require("../config/prisma");
const { sendReportEmail } = require("../config/mailer");

function validationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function subscribe(emailInput, consent) {
  const tenantId = process.env.PUBLIC_TENANT_ID?.trim();
  if (!tenantId) throw validationError("The newsletter is not configured", 503);

  if (consent !== true) throw validationError("Please confirm you want to receive FleetLink email updates");
  if (typeof emailInput !== "string") throw validationError("Enter a valid email address");

  const email = emailInput.trim().toLowerCase();
  if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
    throw validationError("Enter a valid email address");
  }

  const subscriber = await prisma.newsletterSubscriber.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: { consentedAt: new Date(), unsubscribedAt: null },
    create: { tenantId, email },
    select: { id: true },
  });

  return { subscribed: true, subscriberId: subscriber.id };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
}

async function getAudience(tenantId) {
  if (!tenantId) throw validationError("A tenant is required", 400);
  const [active, total] = await Promise.all([
    prisma.newsletterSubscriber.count({ where: { tenantId, unsubscribedAt: null } }),
    prisma.newsletterSubscriber.count({ where: { tenantId } }),
  ]);
  return { active, total, unsubscribed: total - active };
}

async function sendCampaign(tenantId, input) {
  const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
  const message = typeof input?.message === "string" ? input.message.trim() : "";
  if (!subject || subject.length > 180) throw validationError("Enter a subject (up to 180 characters)");
  if (!message || message.length > 10000) throw validationError("Enter a message (up to 10,000 characters)");
  if (!tenantId) throw validationError("A tenant is required", 400);
  if (!process.env.SMTP_HOST || !(process.env.SMTP_FROM || process.env.SMTP_USER)) {
    throw validationError("Email delivery is not configured. Set SMTP_HOST and SMTP_FROM (or SMTP_USER).", 503);
  }

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { tenantId, unsubscribedAt: null },
    select: { email: true, unsubscribeToken: true },
    orderBy: { createdAt: "asc" },
  });
  const configuredApiUrl = process.env.PUBLIC_API_URL?.trim();
  if (!configuredApiUrl) throw validationError("Email delivery requires PUBLIC_API_URL so unsubscribe links work", 503);
  const publicApiUrl = configuredApiUrl.replace(/\/$/, "");
  let sent = 0;
  const failed = [];
  for (const subscriber of subscribers) {
    const unsubscribeUrl = `${publicApiUrl}/api/newsletter/unsubscribe/${encodeURIComponent(subscriber.unsubscribeToken)}`;
    const text = `${message}\n\nUnsubscribe from FleetLink updates: ${unsubscribeUrl}`;
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</div><hr><p style="font-size:12px;color:#64748b">You received this because you subscribed to FleetLink email updates. <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a></p>`;
    try {
      await sendReportEmail({
        to: subscriber.email,
        subject,
        text,
        html,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      sent += 1;
    } catch (error) {
      failed.push(subscriber.email);
    }
  }
  return { audience: subscribers.length, sent, failed: failed.length, failedRecipients: failed.slice(0, 20) };
}

async function unsubscribe(token) {
  if (!token) throw validationError("Invalid unsubscribe link", 404);
  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token }, select: { id: true } });
  if (!subscriber) throw validationError("This unsubscribe link is invalid or has expired", 404);
  await prisma.newsletterSubscriber.update({ where: { id: subscriber.id }, data: { unsubscribedAt: new Date() } });
}

module.exports = { subscribe, getAudience, sendCampaign, unsubscribe };
