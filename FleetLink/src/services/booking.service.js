const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { parseUtcIso8601, toUtcIso8601 } = require("../utils/time-range-overlap");
const {
  parsePassengerCount,
  parseJustification,
  parseComment,
  parseBookingKind,
  parseBookingServiceType,
  parseBookingStatus,
  parseChauffeuredDetails,
  canTransition,
  TERMINAL_STATUSES,
} = require("../utils/booking-validation");
const { findOverlappingApprovedBookings } = require("./vehicle-availability.service");
const { getBoss } = require("../config/boss");
const {
  initializeBookingEscalation,
  cancelEscalationTimer,
} = require("./booking-escalation.service");
const {
  buildApprovalTrailEvent,
  resolveInitialApprover,
  resolveNextApprover,
  getApprovalStepLabel,
} = require("../utils/booking-approval");
const { validateEntityCustomData } = require("./custom-fields.service");

const bookingSelect = {
  id: true,
  tenantId: true,
  vehicleId: true,
  driverId: true,
  requestedById: true,
  assignedApproverId: true,
  kind: true,
  serviceType: true,
  status: true,
  justification: true,
  purposeCategory: true,
  destination: true,
  pickupLocation: true,
  guestName: true,
  guestContact: true,
  passengerCount: true,
  comment: true,
  startAt: true,
  endAt: true,
  approvedAt: true,
  rejectedAt: true,
  escalatedAt: true,
  escalationJobId: true,
  escalationScheduledFor: true,
  approvalTrail: true,
  customData: true,
  createdAt: true,
  updatedAt: true,
};

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function conflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function notFoundError(message = "Booking not found") {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function invalidTransitionError(from, action) {
  return validationError(`Cannot ${action} a booking in ${from} status`);
}

function parseBookingWindow(body = {}) {
  const startAt = parseUtcIso8601(body.start, "start");
  const endAt = parseUtcIso8601(body.end, "end");
  if (endAt.getTime() <= startAt.getTime()) {
    throw validationError("end must be after start");
  }
  return { startAt, endAt };
}

function serializeBooking(booking) {
  return {
    ...booking,
    startAt: toUtcIso8601(booking.startAt),
    endAt: toUtcIso8601(booking.endAt),
    approvedAt: booking.approvedAt ? toUtcIso8601(booking.approvedAt) : null,
    rejectedAt: booking.rejectedAt ? toUtcIso8601(booking.rejectedAt) : null,
    escalatedAt: booking.escalatedAt ? toUtcIso8601(booking.escalatedAt) : null,
    escalationScheduledFor: booking.escalationScheduledFor
      ? toUtcIso8601(booking.escalationScheduledFor)
      : null,
    createdAt: toUtcIso8601(booking.createdAt),
    updatedAt: toUtcIso8601(booking.updatedAt),
  };
}

async function listBookings(tenantId, options = {}, actor = {}) {
  const parsedLimit = Number(options.limit ?? 100);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
    throw validationError("limit must be a whole number between 1 and 500");
  }
  const where = { tenantId };
  const actorId = actor.userId ?? actor.id ?? actor.sub;
  if (actor.role === "STAFF") where.requestedById = actorId;
  if (actor.role === "DEPARTMENT_HEAD") where.OR = [{ assignedApproverId: actorId }, { requestedById: actorId }];
  if (options.status) where.status = options.status;
  if (options.vehicleId) where.vehicleId = options.vehicleId;
  if (options.kind) where.kind = options.kind;
  const bookings = await prisma.booking.findMany({
    where,
    select: {
      ...bookingSelect,
      vehicle: { select: { id: true, registration: true, make: true, model: true } },
      requestedBy: { select: { id: true, name: true, email: true, contact: true, departmentId: true } },
      assignedApprover: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: parsedLimit,
  });
  return bookings.map(serializeBooking);
}

async function getTenantVehicle(tenantId, vehicleId) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId, retiredAt: null },
  });
  if (!vehicle) {
    throw notFoundError("Vehicle not found or unavailable");
  }
  return vehicle;
}

async function getTenantBooking(tenantId, bookingId) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    select: bookingSelect,
  });
  if (!booking) {
    throw notFoundError();
  }
  return booking;
}

async function assertNoApprovedSlotConflict(tenantId, vehicleId, startAt, endAt, excludeBookingId) {
  const conflicts = await findOverlappingApprovedBookings(tenantId, startAt, endAt, {
    vehicleId,
    excludeBookingId,
  });
  if (conflicts.length) {
    throw conflictError("The requested vehicle slot conflicts with an approved booking");
  }
}

async function lockVehicleForUpdate(tx, tenantId, vehicleId) {
  const rows = await tx.$queryRaw`
    SELECT id
    FROM "Vehicle"
    WHERE id = ${vehicleId}
      AND "tenantId" = ${tenantId}
      AND "retiredAt" IS NULL
    FOR UPDATE
  `;
  if (!rows.length) {
    throw notFoundError("Vehicle not found or unavailable");
  }
}

async function createBooking(tenantId, requestedById, data) {
  const { startAt, endAt } = parseBookingWindow(data);
  const justification = parseJustification(data.justification);
  const passengerCount = parsePassengerCount(data.passengerCount);
  const kind = parseBookingKind(data.kind);
  const serviceType = parseBookingServiceType(data.serviceType);
  const customData = await validateEntityCustomData(tenantId, "booking", data.customData || {});
  const chauffeuredDetails = serviceType === "CHAUFFEURED_TRANSFER" ? parseChauffeuredDetails(data) : {};

  if (!data.vehicleId) {
    throw validationError("vehicleId is required");
  }

  const requester = await prisma.user.findUnique({
    where: { id: requestedById },
    select: { id: true, name: true, email: true, role: true, departmentId: true, tenantId: true },
  });
  if (!requester || requester.tenantId !== tenantId) {
    throw validationError("Invalid booking requester");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, sector: true, package: true, approvalWorkflow: true },
  });
  if (!tenant) {
    throw validationError("Tenant not found");
  }

  await getTenantVehicle(tenantId, data.vehicleId);
  await assertNoApprovedSlotConflict(tenantId, data.vehicleId, startAt, endAt);

  const initialApprover = await resolveInitialApprover({
    tenant,
    departmentId: requester.departmentId,
    requesterId: requester.id,
    requesterRole: requester.role,
  });

  const approvalTrail = [
    buildApprovalTrailEvent({
      step: "REQUEST_SUBMISSION",
      actorId: requester.id,
      actorName: requester.name,
      actorEmail: requester.email,
      actorRole: requester.role,
      action: "REQUESTED",
      auto: false,
    }),
  ];

  const destination = typeof data.destination === "string" ? data.destination.trim() : "";
  const booking = await prisma.booking.create({
    data: {
      tenantId,
      vehicleId: data.vehicleId,
      requestedById,
      assignedApproverId: initialApprover?.id || null,
      kind,
      serviceType,
      status: "PENDING",
      justification,
      purposeCategory: typeof data.purposeCategory === "string" ? data.purposeCategory.trim() || null : null,
      destination: destination || null,
      pickupLocation: chauffeuredDetails.pickupLocation || null,
      guestName: chauffeuredDetails.guestName || null,
      guestContact: chauffeuredDetails.guestContact || null,
      passengerCount,
      startAt,
      endAt,
      approvalTrail,
      customData,
    },
    select: bookingSelect,
  });

  const boss = getBoss();
  if (boss) {
    await initializeBookingEscalation(boss, booking.id);
  }

  const refreshed = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: bookingSelect,
  });

  return serializeBooking(refreshed ?? booking);
}

async function approveBooking(tenantId, bookingId, approver, decision = {}) {
  try {
    const comment = parseComment(decision.comment);
    const approverId = approver.userId ?? approver.id ?? approver.sub;

    const approverRecord = await prisma.user.findFirst({
      where: { id: approverId, tenantId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!approverRecord) {
      throw validationError("Invalid approver");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, sector: true, package: true, approvalWorkflow: true },
    });
    if (!tenant) {
      throw validationError("Tenant not found");
    }

    const booking = await prisma.$transaction(
      async (tx) => {
        const pending = await tx.booking.findFirst({
          where: { id: bookingId, tenantId },
          select: bookingSelect,
        });
        if (!pending) {
          throw notFoundError();
        }
        if (pending.status !== "PENDING") {
          throw invalidTransitionError(pending.status, "approve");
        }

        const isAssignedApprover = pending.assignedApproverId && pending.assignedApproverId === approverId;
        const isManagerOverride = ["SUPER_ADMIN", "FLEET_MANAGER"].includes(approverRecord.role);
        const isUnassigned = !pending.assignedApproverId;

        if (!isAssignedApprover && !isManagerOverride && !isUnassigned) {
          throw validationError("Only the assigned approver or a Fleet Manager / Super Admin may approve this booking");
        }

        const assignedVehicleId = decision.vehicleId || pending.vehicleId;
        await lockVehicleForUpdate(tx, tenantId, assignedVehicleId);

        if (decision.driverId) {
          const driver = await tx.driver.findFirst({ where: { id: decision.driverId, tenantId, employmentStatus: "ACTIVE" }, select: { id: true } });
          if (!driver) throw validationError("Assigned driver is not active or does not belong to this tenant");
        }

        const conflicts = await tx.booking.findMany({
          where: {
            tenantId,
            vehicleId: assignedVehicleId,
            status: "APPROVED",
            id: { not: pending.id },
            startAt: { lt: pending.endAt },
            endAt: { gt: pending.startAt },
          },
          select: { id: true },
        });
        if (conflicts.length) {
          throw conflictError("Cannot approve booking because the vehicle calendar slot is already locked");
        }

        const approvalEvent = buildApprovalTrailEvent({
          step: getApprovalStepLabel(approverRecord.role),
          actorId: approverRecord.id,
          actorName: approverRecord.name,
          actorEmail: approverRecord.email,
          actorRole: approverRecord.role,
          action: "APPROVED",
          comment,
          auto: false,
        });

        let nextApprover = await resolveNextApprover({
          tenant,
          currentApproverRole: approverRecord.role,
          tenantId,
          bookingId: pending.id,
        });
        if (nextApprover?.id === approverRecord.id) nextApprover = null;

        const updateData = {
          comment,
          approvalTrail: { push: approvalEvent },
          ...(decision.vehicleId ? { vehicleId: assignedVehicleId } : {}),
          ...(decision.driverId !== undefined ? { driverId: decision.driverId || null } : {}),
        };

        if (nextApprover) {
          updateData.assignedApproverId = nextApprover.id;
        } else {
          updateData.status = "APPROVED";
          updateData.approvedAt = new Date();
        }

        const updated = await tx.booking.update({
          where: { id: pending.id },
          data: updateData,
          select: bookingSelect,
        });
        if (updated.status === "APPROVED") {
          await tx.trip.upsert({
            where: { bookingId: updated.id },
            create: { tenantId, bookingId: updated.id, vehicleId: updated.vehicleId, driverId: updated.driverId || null, status: "PLANNED", routeData: updated.destination ? { destination: updated.destination } : undefined },
            update: { vehicleId: updated.vehicleId, driverId: updated.driverId || null, routeData: updated.destination ? { destination: updated.destination } : undefined },
          });
        }
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (booking.status === "APPROVED") {
      const boss = getBoss();
      if (boss) {
        await cancelEscalationTimer(boss, bookingId);
      }
    }

    return serializeBooking(booking);
  } catch (error) {
    if (error.code === "P2034") {
      throw conflictError("Unable to approve booking due to a concurrent calendar update");
    }
    throw error;
  }
}

async function rejectBooking(tenantId, bookingId, approver, data) {
  const comment = parseComment(data.comment);
  const approverId = approver.userId ?? approver.id ?? approver.sub;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    select: bookingSelect,
  });
  if (!booking) {
    throw notFoundError();
  }
  if (booking.status !== "PENDING") {
    throw invalidTransitionError(booking.status, "reject");
  }

  const approverRecord = await prisma.user.findFirst({
    where: { id: approverId, tenantId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!approverRecord) {
    throw validationError("Invalid approver");
  }

  const isAssignedApprover = booking.assignedApproverId && booking.assignedApproverId === approverId;
  const isManagerOverride = ["SUPER_ADMIN", "FLEET_MANAGER"].includes(approverRecord.role);
  const isUnassigned = !booking.assignedApproverId;

  if (!isAssignedApprover && !isManagerOverride && !isUnassigned) {
    throw validationError("Only the assigned approver or a Fleet Manager / Super Admin may reject this booking");
  }

  const rejectionEvent = buildApprovalTrailEvent({
    step: getApprovalStepLabel(approverRecord.role),
    actorId: approverRecord.id,
    actorName: approverRecord.name,
    actorEmail: approverRecord.email,
    actorRole: approverRecord.role,
    action: "REJECTED",
    comment,
    auto: false,
  });

  const rejected = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "REJECTED",
      comment,
      rejectedAt: new Date(),
      approvalTrail: { push: rejectionEvent },
    },
    select: bookingSelect,
  });

  const boss = getBoss();
  if (boss) {
    await cancelEscalationTimer(boss, bookingId);
  }

  return serializeBooking(rejected);
}

async function updateBooking(tenantId, bookingId, data = {}) {
  const booking = await getTenantBooking(tenantId, bookingId);
  const { startAt, endAt } = parseBookingWindow({
    start: data.start ?? booking.startAt.toISOString(),
    end: data.end ?? booking.endAt.toISOString(),
  });
  const passengerCount = data.passengerCount === undefined ? booking.passengerCount : parsePassengerCount(data.passengerCount);
  const justification = data.justification === undefined ? booking.justification : parseJustification(data.justification);
  const purposeCategory = data.purposeCategory === undefined ? booking.purposeCategory : (String(data.purposeCategory || "").trim() || null);
  const destination = data.destination === undefined ? booking.destination : String(data.destination || "").trim() || null;
  const serviceType = data.serviceType === undefined ? booking.serviceType : parseBookingServiceType(data.serviceType);
  const status = data.status === undefined ? booking.status : parseBookingStatus(data.status);
  const vehicleId = data.vehicleId === undefined ? booking.vehicleId : data.vehicleId;
  if (!vehicleId) throw validationError("vehicleId is required");
  await getTenantVehicle(tenantId, vehicleId);
  if (status !== booking.status && !canTransition(booking.status, status)) {
    throw invalidTransitionError(booking.status, `change status to ${status}`);
  }
  if (status === "APPROVED") {
    await assertNoApprovedSlotConflict(tenantId, vehicleId, startAt, endAt, booking.id);
  }
  const chauffeuredDetails = serviceType === "CHAUFFEURED_TRANSFER"
    ? parseChauffeuredDetails({ pickupLocation: data.pickupLocation ?? booking.pickupLocation, guestName: data.guestName ?? booking.guestName, guestContact: data.guestContact ?? booking.guestContact })
    : { pickupLocation: null, guestName: null, guestContact: null };
  const updateData = { vehicleId, startAt, endAt, passengerCount, justification, purposeCategory, destination, serviceType, ...chauffeuredDetails };
  if (status !== booking.status) {
    updateData.status = status;
    if (status === "APPROVED") updateData.approvedAt = new Date();
    if (status === "REJECTED") updateData.rejectedAt = new Date();
  }
  const updated = await prisma.$transaction(async tx => {
    const changed = await tx.booking.update({ where: { id: booking.id }, data: updateData, select: bookingSelect });
    if (changed.status === "APPROVED") {
      await tx.trip.upsert({
        where: { bookingId: changed.id },
        create: { tenantId, bookingId: changed.id, vehicleId: changed.vehicleId, driverId: changed.driverId || null, status: "PLANNED", routeData: changed.destination ? { destination: changed.destination } : undefined },
        update: { vehicleId: changed.vehicleId, driverId: changed.driverId || null, routeData: changed.destination ? { destination: changed.destination } : undefined },
      });
    }
    return changed;
  });
  if (status !== booking.status && TERMINAL_STATUSES.has(status)) {
    const boss = getBoss();
    if (boss) await cancelEscalationTimer(boss, booking.id);
  }
  return serializeBooking(updated);
}

async function deleteBooking(tenantId, bookingId) {
  const booking = await getTenantBooking(tenantId, bookingId);
  await prisma.$transaction([
    prisma.trip.deleteMany({ where: { bookingId: booking.id } }),
    prisma.booking.delete({ where: { id: booking.id } }),
  ]);
  const boss = getBoss();
  if (boss) await cancelEscalationTimer(boss, booking.id);
}

module.exports = {
  bookingSelect,
  listBookings,
  createBooking,
  approveBooking,
  rejectBooking,
  updateBooking,
  deleteBooking,
  serializeBooking,
  canTransition,
  parseJustification,
  parseComment,
  parsePassengerCount,
  TERMINAL_STATUSES,
};
