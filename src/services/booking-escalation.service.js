const prisma = require("../config/prisma");
const { scheduleReminder } = require("./notification.service");
const {
  thresholdMsFromTenant,
  computeEscalationScheduledFor,
  requiresImmediateDepartureAlert,
  resolveEscalationTarget,
} = require("../utils/booking-escalation");
const { toUtcIso8601 } = require("../utils/time-range-overlap");

const BOOKING_ESCALATION_JOB = "booking-escalation";

const escalationBookingSelect = {
  id: true,
  tenantId: true,
  status: true,
  startAt: true,
  endAt: true,
  justification: true,
  passengerCount: true,
  assignedApproverId: true,
  escalationJobId: true,
  escalationScheduledFor: true,
  escalatedAt: true,
  createdAt: true,
  vehicle: { select: { registration: true } },
  requestedBy: { select: { name: true, email: true } },
};

async function findPrimaryApprover(tenantId) {
  return prisma.user.findFirst({
    where: { tenantId, role: "FLEET_MANAGER", isActive: true },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true },
  });
}

async function loadTenantEscalationContext(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      bookingEscalationThresholdMs: true,
      owner: { select: { id: true, email: true, name: true, role: true, isActive: true } },
      backupApprover: { select: { id: true, email: true, name: true, role: true, isActive: true } },
    },
  });
  if (!tenant) return null;

  const superAdmins = await prisma.user.findMany({
    where: { tenantId, role: "SUPER_ADMIN", isActive: true },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });

  return { tenant, superAdmins };
}

async function notifyApprover({ boss, tenantId, approver, booking, subjectPrefix, urgent = false }) {
  if (!boss || !approver?.email) return null;

  const prefix = urgent ? "[URGENT] " : "";
  const subject = `${prefix}${subjectPrefix}: ${booking.vehicle.registration}`;
  const message = [
    `Booking ${booking.id} requires action.`,
    `Vehicle: ${booking.vehicle.registration}`,
    `Departure: ${toUtcIso8601(booking.startAt)}`,
    `Requested by: ${booking.requestedBy.name} (${booking.requestedBy.email})`,
    `Justification: ${booking.justification}`,
    `Passengers: ${booking.passengerCount}`,
  ].join("\n");

  return scheduleReminder({
    boss,
    tenantId,
    targetDatetime: new Date(),
    offsetMs: 0,
    channel: "EMAIL",
    recipient: approver.email,
    subject,
    message,
    payload: {
      alertType: urgent ? "BOOKING_IMMEDIATE_DEPARTURE" : "BOOKING_APPROVAL_REQUEST",
      bookingId: booking.id,
      vehicleRegistration: booking.vehicle.registration,
      startAt: toUtcIso8601(booking.startAt),
      urgent,
    },
    dedupKey: `${urgent ? "urgent" : "request"}:booking:${booking.id}:${approver.id}`,
  });
}

async function scheduleEscalationTimer(boss, bookingId) {
  if (!boss) return null;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: escalationBookingSelect,
  });
  if (!booking || booking.status !== "PENDING") return booking;

  const context = await loadTenantEscalationContext(booking.tenantId);
  if (!context) return booking;

  const thresholdMs = thresholdMsFromTenant(context.tenant);
  const scheduledFor = computeEscalationScheduledFor(booking.createdAt, thresholdMs);

  const jobId = await boss.send(
    BOOKING_ESCALATION_JOB,
    { bookingId: booking.id, tenantId: booking.tenantId },
    {
      startAfter: scheduledFor,
      singletonKey: `booking-escalation:${booking.id}`,
    }
  );

  return prisma.booking.update({
    where: { id: booking.id },
    data: { escalationJobId: String(jobId), escalationScheduledFor: scheduledFor },
    select: escalationBookingSelect,
  });
}

async function cancelEscalationTimer(boss, bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, escalationJobId: true, status: true },
  });
  if (!booking?.escalationJobId) return;

  if (boss) {
    try {
      await boss.cancel(booking.escalationJobId);
    } catch (error) {
      console.warn("Unable to cancel booking escalation job", {
        bookingId,
        jobId: booking.escalationJobId,
        error: error.message,
      });
    }
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { escalationJobId: null, escalationScheduledFor: null },
  });
}

async function initializeBookingEscalation(boss, bookingId) {
  if (!boss) return null;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: escalationBookingSelect,
  });
  if (!booking || booking.status !== "PENDING") return booking;

  const context = await loadTenantEscalationContext(booking.tenantId);
  if (!context) return booking;

  const assignedApprover = booking.assignedApproverId
    ? await prisma.user.findUnique({
        where: { id: booking.assignedApproverId },
        select: { id: true, email: true, name: true, role: true },
      })
    : null;
  const primaryApprover = await findPrimaryApprover(booking.tenantId);
  const thresholdMs = thresholdMsFromTenant(context.tenant);
  const urgent = requiresImmediateDepartureAlert(new Date(), booking.startAt, thresholdMs);

  let current = booking;
  let currentApprover = assignedApprover;
  let fallbackApprover = null;

  if (!currentApprover && primaryApprover) {
    currentApprover = primaryApprover;
    current = await prisma.booking.update({
      where: { id: booking.id },
      data: { assignedApproverId: primaryApprover.id },
      select: escalationBookingSelect,
    });
  }

  if (!currentApprover) {
    fallbackApprover = resolveEscalationTarget({
      backupApprover: context.tenant.backupApprover,
      owner: context.tenant.owner,
      superAdmins: context.superAdmins,
    });
    if (fallbackApprover) {
      currentApprover = fallbackApprover;
      current = await prisma.booking.update({
        where: { id: booking.id },
        data: { assignedApproverId: fallbackApprover.id },
        select: escalationBookingSelect,
      });
    }
  }

  if (currentApprover) {
    await notifyApprover({
      boss,
      tenantId: booking.tenantId,
      approver: currentApprover,
      booking: current,
      subjectPrefix: "New booking approval request",
    });
  }

  if (urgent && currentApprover) {
    await notifyApprover({
      boss,
      tenantId: booking.tenantId,
      approver: currentApprover,
      booking: current,
      subjectPrefix: "Immediate booking alert (< 2h to departure)",
      urgent: true,
    });
  }

  return scheduleEscalationTimer(boss, booking.id);
}

async function processBookingEscalation(boss, bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: escalationBookingSelect,
  });
  if (!booking || booking.status !== "PENDING") {
    return { escalated: false, reason: "BOOKING_ALREADY_ACTIONED" };
  }

  const context = await loadTenantEscalationContext(booking.tenantId);
  if (!context) {
    return { escalated: false, reason: "TENANT_NOT_FOUND" };
  }

  const escalationTarget = resolveEscalationTarget({
    backupApprover: context.tenant.backupApprover,
    owner: context.tenant.owner,
    superAdmins: context.superAdmins,
  });

  if (!escalationTarget) {
    return { escalated: false, reason: "NO_ESCALATION_TARGET" };
  }

  const escalated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      assignedApproverId: escalationTarget.id,
      escalatedAt: new Date(),
      escalationJobId: null,
      escalationScheduledFor: null,
    },
    select: escalationBookingSelect,
  });

  await notifyApprover({
    boss,
    tenantId: booking.tenantId,
    approver: escalationTarget,
    booking: escalated,
    subjectPrefix: "Escalated booking approval required",
    urgent: true,
  });

  return {
    escalated: true,
    bookingId: booking.id,
    assignedApproverId: escalationTarget.id,
    assignedApproverEmail: escalationTarget.email,
  };
}

function registerBookingEscalationWorker(boss) {
  if (!boss || typeof boss.work !== "function") {
    throw new Error("A pg-boss instance is required");
  }
  return boss.work(BOOKING_ESCALATION_JOB, (job) => processBookingEscalation(boss, job.data.bookingId));
}

module.exports = {
  BOOKING_ESCALATION_JOB,
  findPrimaryApprover,
  initializeBookingEscalation,
  cancelEscalationTimer,
  processBookingEscalation,
  registerBookingEscalationWorker,
};
