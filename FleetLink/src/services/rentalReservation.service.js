const prisma = require("../config/prisma");
const { getBoss } = require("../config/boss");
const { scheduleReminder } = require("./notification.service");
const { parseUtcIso8601 } = require("../utils/time-range-overlap");
const {
  parseReservationWindow,
  parsePositiveDecimal,
  parseRentalAgreement,
  parseBoolean,
  validationError,
} = require("../utils/rental-validation");

const RENTAL_OVERDUE_JOB = "rental-overdue-scan";
const DEFAULT_LATE_FEE_RATE_PERCENT = 25;
const DAILY_LATE_FEE_BASE_PERCENT = 0.01;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const reservationSelect = {
  id: true,
  tenantId: true,
  vehicleId: true,
  customerId: true,
  status: true,
  startAt: true,
  endAt: true,
  agreedRate: true,
  depositAmount: true,
  depositPaid: true,
  lateFeeAmount: true,
  overdueAt: true,
  rentalAgreement: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, email: true, driverLicense: true, contact: true } },
  vehicle: { select: { id: true, registration: true, make: true, model: true } },
  inspections: {
    select: {
      id: true,
      inspectionType: true,
      odometerReading: true,
      fuelLevel: true,
      chargeLevel: true,
      conditionNotes: true,
      conditionPhotos: true,
      fuelShortfall: true,
      chargeShortfall: true,
      distanceDriven: true,
      conditionDiff: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
  returnReminderJobIds: true,
};

async function listRentalReservations(tenantId, options = {}) {
  const limit = Number(options.limit ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw validationError("limit must be a whole number between 1 and 500");
  const where = { tenantId };
  if (options.status) {
    if (!["RESERVED", "ACTIVE", "COMPLETED", "OVERDUE"].includes(options.status)) throw validationError("status is invalid");
    where.status = options.status;
  }
  if (options.vehicleId) where.vehicleId = options.vehicleId;
  if (options.customerId) where.customerId = options.customerId;
  return prisma.rentalReservation.findMany({ where, select: reservationSelect, orderBy: { createdAt: "desc" }, take: limit });
}

async function getTenantVehicle(tenantId, vehicleId) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId, retiredAt: null },
  });
  if (!vehicle) {
    throw validationError("Vehicle not found or unavailable");
  }
  return vehicle;
}

async function getCustomer(tenantId, customerId) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
  });
  if (!customer) {
    throw validationError("Customer not found");
  }
  return customer;
}

async function validateOverlappingReservation(tenantId, vehicleId, startAt, endAt) {
  const overlap = await prisma.rentalReservation.findFirst({
    where: {
      tenantId,
      vehicleId,
      status: { in: ["RESERVED", "ACTIVE", "OVERDUE"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  if (overlap) {
    throw validationError("The requested vehicle is already reserved for the requested period");
  }
}

async function validateCustomerOverdue(customerId) {
  const now = new Date();
  const overdue = await prisma.rentalReservation.findFirst({
    where: {
      customerId,
      OR: [
        { status: "OVERDUE" },
        { status: "ACTIVE", endAt: { lt: now } },
      ],
    },
  });
  if (overdue) {
    throw validationError("Customer has an active overdue rental and cannot make a new reservation");
  }
}

function calculateDaysLate(endAt, now = new Date()) {
  const hoursLate = Math.max(0, now.getTime() - new Date(endAt).getTime()) / (60 * 60 * 1000);
  return Math.max(1, Math.ceil(hoursLate / 24));
}

function computeLateFee(reservation, ratePercent = DEFAULT_LATE_FEE_RATE_PERCENT) {
  const daysLate = calculateDaysLate(reservation.endAt);
  const dailyFee = Number(reservation.agreedRate) * (Number(ratePercent) * DAILY_LATE_FEE_BASE_PERCENT);
  const capped = Math.min(Number(reservation.depositAmount), dailyFee * daysLate);
  return capped.toFixed(2);
}

async function validateExtensionConflict(tenantId, vehicleId, reservationId, currentEndAt, newEndAt) {
  const conflict = await prisma.rentalReservation.findFirst({
    where: {
      tenantId,
      vehicleId,
      id: { not: reservationId },
      status: { in: ["RESERVED", "ACTIVE", "OVERDUE"] },
      startAt: { lt: newEndAt },
      endAt: { gt: currentEndAt },
    },
  });
  if (conflict) {
    throw validationError("Extension rejected: vehicle has a conflicting reservation for another customer");
  }
}

function parseExtensionEndAt(body = {}) {
  const endAt = parseUtcIso8601(body.newEnd || body.end, "newEnd");
  return endAt;
}

function parseInspectionPayload(data) {
  const odometerReading = parsePositiveDecimal(data.odometerReading, "odometerReading");
  const fuelLevel = data.fuelLevel !== undefined && data.fuelLevel !== null ? parsePositiveDecimal(data.fuelLevel, "fuelLevel") : null;
  const chargeLevel = data.chargeLevel !== undefined && data.chargeLevel !== null ? parsePositiveDecimal(data.chargeLevel, "chargeLevel") : null;
  const conditionNotes = typeof data.conditionNotes === "string" ? data.conditionNotes.trim() : null;
  const conditionPhotos = data.conditionPhotos == null ? [] : Array.isArray(data.conditionPhotos) ? data.conditionPhotos.map(String).filter(Boolean) : null;

  if (!odometerReading) {
    throw validationError("odometerReading is required");
  }
  if (conditionPhotos === null) {
    throw validationError("conditionPhotos must be an array of photo URLs");
  }

  return { odometerReading, fuelLevel, chargeLevel, conditionNotes, conditionPhotos };
}

function notesConfirmNoDamage(conditionNotes) {
  if (!conditionNotes) return false;
  const normalized = conditionNotes.toLowerCase();
  return ["no damage", "no new damage", "no visible damage", "no damage observed", "no damage reported", "no issues", "no issues noted", "clean return", "vehicle in good condition"].some((phrase) => normalized.includes(phrase));
}

function computeConditionDiff(checkoutNotes, checkinNotes) {
  const normalizedCheckout = checkoutNotes ? checkoutNotes.trim() : "";
  const normalizedCheckin = checkinNotes ? checkinNotes.trim() : "";
  if (normalizedCheckout === normalizedCheckin) {
    return "No condition changes reported.";
  }
  if (!normalizedCheckout && normalizedCheckin) {
    return `Initial condition note: ${normalizedCheckin}`;
  }
  if (normalizedCheckout && !normalizedCheckin) {
    return `Checkout condition: ${normalizedCheckout}; no return condition notes provided.`;
  }
  return `Checkout condition: ${normalizedCheckout}; Return condition: ${normalizedCheckin}`;
}

async function createRentalCheckout(tenantId, reservationId, data) {
  const inspectionPayload = parseInspectionPayload(data);
  if (!inspectionPayload.conditionPhotos.length) {
    throw validationError("Checkout requires inspection photos");
  }

  const reservation = await prisma.rentalReservation.findFirst({
    where: { id: reservationId, tenantId },
    select: { id: true, status: true },
  });
  if (!reservation) {
    throw validationError("Rental reservation not found");
  }
  if (reservation.status !== "RESERVED") {
    throw validationError("Check-out is only allowed for reserved rentals");
  }

  await prisma.rentalInspection.create({
    data: {
      reservationId,
      inspectionType: "CHECKOUT",
      odometerReading: inspectionPayload.odometerReading,
      fuelLevel: inspectionPayload.fuelLevel,
      chargeLevel: inspectionPayload.chargeLevel,
      conditionNotes: inspectionPayload.conditionNotes,
      conditionPhotos: inspectionPayload.conditionPhotos,
    },
  });

  return prisma.rentalReservation.update({
    where: { id: reservationId },
    data: { status: "ACTIVE" },
    select: reservationSelect,
  });
}

async function createRentalCheckin(tenantId, reservationId, data) {
  const inspectionPayload = parseInspectionPayload(data);

  const reservation = await prisma.rentalReservation.findFirst({
    where: { id: reservationId, tenantId },
    select: { id: true, status: true },
  });
  if (!reservation) {
    throw validationError("Rental reservation not found");
  }
  if (!["ACTIVE", "OVERDUE"].includes(reservation.status)) {
    throw validationError("Check-in is only allowed for active or overdue rentals");
  }

  const checkout = await prisma.rentalInspection.findFirst({
    where: { reservationId, inspectionType: "CHECKOUT" },
    select: { odometerReading: true, fuelLevel: true, chargeLevel: true, conditionNotes: true },
  });
  if (!checkout) {
    throw validationError("A checkout inspection is required before check-in");
  }

  const checkoutOdometer = Number(checkout.odometerReading);
  const checkinOdometer = Number(inspectionPayload.odometerReading);
  if (checkinOdometer < checkoutOdometer) {
    throw validationError("Check-in odometer reading cannot be lower than checkout odometer reading");
  }

  const distanceDriven = checkinOdometer - checkoutOdometer;
  const fuelShortfall = checkout.fuelLevel != null && inspectionPayload.fuelLevel != null
    ? Number(checkout.fuelLevel) - Number(inspectionPayload.fuelLevel)
    : null;
  const chargeShortfall = checkout.chargeLevel != null && inspectionPayload.chargeLevel != null
    ? Number(checkout.chargeLevel) - Number(inspectionPayload.chargeLevel)
    : null;
  const conditionDiff = computeConditionDiff(checkout.conditionNotes, inspectionPayload.conditionNotes);

  if (!inspectionPayload.conditionPhotos.length && !notesConfirmNoDamage(inspectionPayload.conditionNotes)) {
    throw validationError("Check-in photos are required unless condition notes confirm no new damage");
  }

  await prisma.rentalInspection.create({
    data: {
      reservationId,
      inspectionType: "CHECKIN",
      odometerReading: inspectionPayload.odometerReading,
      fuelLevel: inspectionPayload.fuelLevel,
      chargeLevel: inspectionPayload.chargeLevel,
      conditionNotes: inspectionPayload.conditionNotes,
      conditionPhotos: inspectionPayload.conditionPhotos,
      distanceDriven: distanceDriven.toFixed(2),
      fuelShortfall: fuelShortfall != null ? fuelShortfall.toFixed(2) : null,
      chargeShortfall: chargeShortfall != null ? chargeShortfall.toFixed(2) : null,
      conditionDiff,
    },
  });

  await cancelReturnReminders(reservationId);

  return prisma.rentalReservation.update({
    where: { id: reservationId },
    data: { status: "COMPLETED" },
    select: reservationSelect,
  });
}

async function resolveOperationsManager(tenantId) {
  const manager = await prisma.user.findFirst({
    where: { tenantId, role: "FLEET_MANAGER", isActive: true },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });
  if (manager) return manager;
  return prisma.user.findFirst({
    where: { tenantId, role: "SUPER_ADMIN", isActive: true },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });
}

function buildReminderMessage({ reservation, reminderLabel, recipientName }) {
  return {
    subject: `${reminderLabel} reminder: rental return due for ${reservation.vehicle.registration}`,
    message: [
      `Hello ${recipientName},`,
      `This is a reminder that rental reservation ${reservation.id} is due to return soon.`,
      `Vehicle: ${reservation.vehicle.registration} (${reservation.vehicle.make} ${reservation.vehicle.model})`,
      `Return deadline: ${reservation.endAt.toISOString()}`,
      `Reminder: ${reminderLabel}`,
    ].join("\n"),
  };
}

async function scheduleReturnReminders(reservation) {
  const boss = getBoss();
  if (!boss) return reservation;

  const operationsManager = await resolveOperationsManager(reservation.tenantId);
  if (!operationsManager) return reservation;

  const now = new Date();
  const endAt = new Date(reservation.endAt);
  const startAt = new Date(reservation.startAt);
  const durationMs = endAt.getTime() - startAt.getTime();
  const reminders = [];

  const scheduleReminderFor = async (scheduledFor, label, recipient, recipientLabel) => {
    const { subject, message } = buildReminderMessage({ reservation, reminderLabel: label, recipientName: recipient.name });
    const notification = await scheduleReminder({
      boss,
      tenantId: reservation.tenantId,
      targetDatetime: endAt,
      offsetMs: Math.max(0, endAt.getTime() - scheduledFor.getTime()),
      channel: "EMAIL",
      recipient: recipient.email,
      subject,
      message,
      payload: { reminderType: label, reservationId: reservation.id, recipient: recipientLabel },
      dedupKey: `return-reminder:reservation:${reservation.id}:${recipientLabel}:${label}`,
    });
    reminders.push(notification.jobId);
  };

  if (durationMs < 24 * 60 * 60 * 1000) {
    const midPoint = new Date(startAt.getTime() + durationMs / 2);
    if (midPoint > now) {
      await scheduleReminderFor(midPoint, "MIDPOINT", reservation.customer, "customer");
      await scheduleReminderFor(midPoint, "MIDPOINT", operationsManager, "operations");
    }
    const twoHoursBefore = new Date(endAt.getTime() - 2 * 60 * 60 * 1000);
    if (twoHoursBefore > now) {
      await scheduleReminderFor(twoHoursBefore, "2H_BEFORE", reservation.customer, "customer");
      await scheduleReminderFor(twoHoursBefore, "2H_BEFORE", operationsManager, "operations");
    }
  } else {
    const twentyFourHoursBefore = new Date(endAt.getTime() - 24 * 60 * 60 * 1000);
    const twelveHoursBefore = new Date(endAt.getTime() - 12 * 60 * 60 * 1000);
    if (twentyFourHoursBefore > now) {
      await scheduleReminderFor(twentyFourHoursBefore, "24H_BEFORE", reservation.customer, "customer");
      await scheduleReminderFor(twentyFourHoursBefore, "24H_BEFORE", operationsManager, "operations");
    }
    if (twelveHoursBefore > now) {
      await scheduleReminderFor(twelveHoursBefore, "12H_BEFORE", reservation.customer, "customer");
      await scheduleReminderFor(twelveHoursBefore, "12H_BEFORE", operationsManager, "operations");
    }
  }

  if (reminders.length) {
    await prisma.rentalReservation.update({
      where: { id: reservation.id },
      data: { returnReminderJobIds: reminders },
    });
  }

  return reservation;
}

async function cancelReturnReminders(reservationId) {
  const boss = getBoss();
  if (!boss) return;

  const notifications = await prisma.notification.findMany({
    where: {
      dedupKey: { startsWith: `return-reminder:reservation:${reservationId}:` },
      status: "SCHEDULED",
      jobId: { not: null },
    },
  });

  await Promise.all(notifications.map(async (notification) => {
    try {
      await boss.cancel(notification.jobId);
    } catch (error) {
      console.warn("Unable to cancel return reminder job", { reservationId, jobId: notification.jobId, error: error.message });
    }
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED", lastError: "Cancelled due to early return" },
    });
  }));
}

async function requestRentalExtension(tenantId, reservationId, data) {
  const newEndAt = parseExtensionEndAt(data);

  const reservation = await prisma.rentalReservation.findFirst({
    where: { id: reservationId, tenantId },
    select: { id: true, vehicleId: true, customerId: true, status: true, startAt: true, endAt: true },
  });
  if (!reservation) {
    throw validationError("Rental reservation not found");
  }
  if (reservation.status === "COMPLETED") {
    throw validationError("Cannot extend a completed reservation");
  }
  if (newEndAt.getTime() <= new Date(reservation.endAt).getTime()) {
    throw validationError("Extension must move the return deadline later");
  }
  if (reservation.status === "OVERDUE") {
    throw validationError("Cannot extend an overdue reservation; please return the vehicle or contact operations");
  }

  await validateExtensionConflict(tenantId, reservation.vehicleId, reservationId, reservation.endAt, newEndAt);

  const updated = await prisma.rentalReservation.update({
    where: { id: reservationId },
    data: { endAt: newEndAt },
    select: reservationSelect,
  });

  await cancelReturnReminders(reservationId);
  await scheduleReturnReminders(updated);

  return updated;
}

async function runRentalOverdueScan(boss) {
  const now = new Date();
  const overdueReservations = await prisma.rentalReservation.findMany({
    where: {
      status: "ACTIVE",
      endAt: { lt: now },
    },
    select: {
      ...reservationSelect,
      tenantId: true,
    },
  });

  await Promise.all(overdueReservations.map(async (reservation) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: reservation.tenantId },
        select: { rentalLateFeeRatePercent: true },
      });
      const lateFeeAmount = computeLateFee(reservation, tenant?.rentalLateFeeRatePercent ?? DEFAULT_LATE_FEE_RATE_PERCENT);

      await cancelReturnReminders(reservation.id);

      const updated = await prisma.rentalReservation.update({
        where: { id: reservation.id },
        data: {
          status: "OVERDUE",
          overdueAt: now,
          lateFeeAmount,
        },
        select: reservationSelect,
      });

      const operationsManager = await resolveOperationsManager(reservation.tenantId);
      const overdueLabel = "OVERDUE";
      if (reservation.customer?.email) {
        await scheduleReminder({
          boss,
          tenantId: reservation.tenantId,
          targetDatetime: now,
          offsetMs: 0,
          channel: "EMAIL",
          recipient: reservation.customer.email,
          subject: `[OVERDUE] Rental return missed for ${reservation.vehicle.registration}`,
          message: `Your rental reservation ${reservation.id} is now overdue. A late fee of $${lateFeeAmount} has been applied and the vehicle must be returned immediately.`,
          payload: { alertType: "RENTAL_OVERDUE", reservationId: reservation.id, lateFeeAmount, recipient: "customer" },
          dedupKey: `overdue-reminder:reservation:${reservation.id}:customer`,
        });
      }
      if (operationsManager?.email) {
        await scheduleReminder({
          boss,
          tenantId: reservation.tenantId,
          targetDatetime: now,
          offsetMs: 0,
          channel: "EMAIL",
          recipient: operationsManager.email,
          subject: `[OVERDUE] Rental reservation ${reservation.id} is overdue`,
          message: `Rental reservation ${reservation.id} for vehicle ${reservation.vehicle.registration} is overdue. Late fee: $${lateFeeAmount}. Please follow up with the customer.`,
          payload: { alertType: "RENTAL_OVERDUE", reservationId: reservation.id, lateFeeAmount, recipient: "operations" },
          dedupKey: `overdue-reminder:reservation:${reservation.id}:operations`,
        });
      }

      return updated;
    } catch (error) {
      console.error("Failed to auto-mark reservation overdue", { reservationId: reservation.id, error: error.message });
      return null;
    }
  }));
}

function registerRentalOverdueWorker(boss) {
  if (!boss || typeof boss.work !== "function") throw validationError("A pg-boss instance is required");
  return boss.work(RENTAL_OVERDUE_JOB, () => runRentalOverdueScan(boss));
}

function scheduleRentalOverdueJob(boss, cron = "0 * * * *") {
  if (!boss || typeof boss.schedule !== "function") throw validationError("A pg-boss instance is required");
  return boss.schedule(RENTAL_OVERDUE_JOB, cron, {});
}

async function createRentalReservation(tenantId, data) {
  const { vehicleId, customerId, agreedRate, depositAmount, depositPaid, rentalAgreement } = data;
  const { startAt, endAt } = parseReservationWindow(data);

  if (!tenantId) {
    throw validationError("tenantId is required");
  }
  if (!vehicleId) {
    throw validationError("vehicleId is required");
  }
  if (!customerId) {
    throw validationError("customerId is required");
  }

  await getTenantVehicle(tenantId, vehicleId);
  await getCustomer(tenantId, customerId);
  await validateCustomerOverdue(customerId);
  await validateOverlappingReservation(tenantId, vehicleId, startAt, endAt);

  const agreedRateValue = parsePositiveDecimal(agreedRate, "agreedRate");
  const depositAmountValue = parsePositiveDecimal(depositAmount, "depositAmount");
  const depositPaidValue = parseBoolean(depositPaid, "depositPaid");
  const agreementDetails = parseRentalAgreement(rentalAgreement);

  const reservation = await prisma.rentalReservation.create({
    data: {
      tenantId,
      vehicleId,
      customerId,
      status: "RESERVED",
      startAt,
      endAt,
      agreedRate: agreedRateValue,
      depositAmount: depositAmountValue,
      depositPaid: depositPaidValue,
      rentalAgreement: agreementDetails,
    },
    select: reservationSelect,
  });

  await scheduleReturnReminders(reservation);

  return reservation;
}

module.exports = {
  listRentalReservations,
  createRentalReservation,
  createRentalCheckout,
  createRentalCheckin,
  requestRentalExtension,
  runRentalOverdueScan,
  registerRentalOverdueWorker,
  scheduleRentalOverdueJob,
};
