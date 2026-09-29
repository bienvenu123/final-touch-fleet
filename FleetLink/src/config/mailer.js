const nodemailer = require("nodemailer");

const transportOptions = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
};

const transporter = nodemailer.createTransport(transportOptions);

async function sendReportEmail({ to, subject, text, html, attachments = [], headers }) {
  if (!to) throw new Error("Email recipient is required");
  const info = await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html, attachments, headers });
  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, response: info.response };
}

module.exports = { sendReportEmail, transporter };
