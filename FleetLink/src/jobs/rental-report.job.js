const { getBoss } = require("../config/boss");
const { createRentalReportAttachment } = require("../services/rentalReport.service");
const { sendReportEmail } = require("../config/mailer");
const { registerNotificationAdapter, createEmailAdapter } = require("../services/notification-adapters.service");

const RENTAL_REPORT_JOB = "rental-performance-report";
let emailAdapterRegistered = false;

async function sendReport(job) {
  const { tenantId, recipient, formatType, currency, locale, start, end } = job.data;
  const service = require("../services/rentalReport.service");
  const report = await service.getRentalPerformanceMetrics(tenantId, { start, end, currency, locale });
  const fileBuffer = await createRentalReportAttachment(report, formatType, { currency, locale });
  const filename = `rental-performance-report.${formatType}`;
  const html = `<p>Please find attached the rental fleet performance report.</p>`;

  return sendReportEmail({
    to: recipient,
    subject: `Rental Fleet Performance Report (${formatType.toUpperCase()})`,
    text: `Your rental fleet performance report is attached.`,
    html,
    attachments: [{ filename, content: fileBuffer }],
  });
}

function registerRentalReportWorker(boss) {
  if (!boss || typeof boss.work !== "function") throw new Error("A pg-boss instance is required");
  if (!emailAdapterRegistered) {
    registerNotificationAdapter("EMAIL", createEmailAdapter(sendReportEmail));
    emailAdapterRegistered = true;
  }
  return boss.work(RENTAL_REPORT_JOB, (job) => sendReport(job));
}

async function scheduleRentalReportJob(boss, tenantId, options = {}) {
  if (!boss || typeof boss.send !== "function") throw new Error("A pg-boss instance is required");
  const scheduledAt = options.scheduleAt ? new Date(options.scheduleAt) : new Date();
  const startAfter = scheduledAt.getTime() <= Date.now() ? undefined : scheduledAt;
  return boss.send(RENTAL_REPORT_JOB, { tenantId, ...options }, { startAfter });
}

module.exports = { RENTAL_REPORT_JOB, registerRentalReportWorker, scheduleRentalReportJob };
