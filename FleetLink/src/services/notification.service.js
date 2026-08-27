const prisma = require("../config/prisma");
const { getNotificationAdapter, normalizeChannel } = require("./notification-adapters.service");

const REMINDER_JOB = "notification-reminder";

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseDate(value, fieldName) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw validationError(`${fieldName} must be a valid date`);
  return date;
}

function parseOffsetMs({ offsetMs, offset }) {
  const value = offsetMs ?? offset ?? 0;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw validationError("offsetMs must be a non-negative whole number of milliseconds");
  return parsed;
}

function stringifyError(error) {
  return error instanceof Error ? error.message : String(error);
}

function serializeResponse(response) {
  if (response === undefined) return null;
  try { return JSON.parse(JSON.stringify(response)); } catch (_) { return { value: String(response) }; }
}

/**
 * Persists and queues one reminder. `offsetMs` is subtracted from targetDatetime.
 * A past calculated time is queued immediately and retained as a warning on the record.
 */
async function scheduleReminder({ boss, tenantId, targetDatetime, offsetMs, offset, channel, recipient, subject, message, payload, dedupKey }) {
  if (!boss || typeof boss.send !== "function") throw validationError("A pg-boss instance is required");
  if (!tenantId) throw validationError("tenantId is required");
  if (!recipient?.trim()) throw validationError("recipient is required");
  if (!message?.trim()) throw validationError("message is required");

  const target = parseDate(targetDatetime, "targetDatetime");
  const parsedOffsetMs = parseOffsetMs({ offsetMs, offset });
  const calculatedSchedule = new Date(target.getTime() - parsedOffsetMs);
  const isPastDue = calculatedSchedule.getTime() <= Date.now();
  const scheduledFor = isPastDue ? new Date() : calculatedSchedule;
  const warning = isPastDue ? "Calculated reminder time is in the past; queued for immediate delivery." : null;
  const normalizedChannel = normalizeChannel(channel);

  const notification = await prisma.notification.create({
    data: { tenantId, channel: normalizedChannel, recipient: recipient.trim(), subject: subject?.trim() || null, message: message.trim(), payload: payload ?? null, dedupKey: dedupKey || null, targetDatetime: target, offsetMs: BigInt(parsedOffsetMs), scheduledFor, warning },
  });

  try {
    const options = isPastDue ? undefined : { startAfter: scheduledFor };
    const jobId = await boss.send(REMINDER_JOB, { notificationId: notification.id }, options);
    return prisma.notification.update({ where: { id: notification.id }, data: { status: "SCHEDULED", jobId: String(jobId) } });
  } catch (error) {
    const errorMessage = stringifyError(error);
    await prisma.$transaction([
      prisma.notification.update({ where: { id: notification.id }, data: { status: "FAILED", lastError: errorMessage } }),
      prisma.notificationDeliveryAttempt.create({ data: { notificationId: notification.id, channel: normalizedChannel, status: "FAILED", error: errorMessage } }),
    ]);
    throw error;
  }
}

// Never throw delivery failures: a provider outage must not fail the pg-boss job or any parent workflow.
async function deliverReminder(notificationId) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.status === "SENT") return notification;

  await prisma.notification.update({ where: { id: notificationId }, data: { status: "SENDING", lastError: null } });
  try {
    const adapter = getNotificationAdapter(notification.channel);
    if (!adapter) throw new Error(`No ${notification.channel} notification adapter has been registered`);
    const response = await adapter.send(notification);
    const providerMessageId = response?.messageId || response?.id || null;
    return await prisma.$transaction(async (tx) => {
      await tx.notificationDeliveryAttempt.create({ data: { notificationId, channel: notification.channel, status: "SENT", response: serializeResponse(response) } });
      return tx.notification.update({ where: { id: notificationId }, data: { status: "SENT", sentAt: new Date(), providerMessageId, lastError: null } });
    });
  } catch (error) {
    const errorMessage = stringifyError(error);
    console.error("Notification delivery failed", { notificationId, channel: notification.channel, error: errorMessage });
    const errorResponse = serializeResponse(error?.response ?? { message: errorMessage });
    await prisma.$transaction([
      prisma.notificationDeliveryAttempt.create({ data: { notificationId, channel: notification.channel, status: "FAILED", error: errorMessage, response: errorResponse } }),
      prisma.notification.update({ where: { id: notificationId }, data: { status: "FAILED", lastError: errorMessage } }),
    ]);
    return null;
  }
}

function registerReminderWorker(boss) {
  if (!boss || typeof boss.work !== "function") throw validationError("A pg-boss instance is required");
  return boss.work(REMINDER_JOB, (job) => deliverReminder(job.data.notificationId));
}

module.exports = { REMINDER_JOB, scheduleReminder, deliverReminder, registerReminderWorker };
