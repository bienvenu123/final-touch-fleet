const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { parseUtcIso8601, toUtcIso8601 } = require("../utils/time-range-overlap");
const {
  parsePassengerCount,
  parseJustification,
  parseComment,
  parseBookingKind,
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

const bookingSelect = {
  id: true,
  tenantId: true,
  vehicleId: true,
  requestedById: true,
  assignedApproverId: true,
  kind: true,
  status: true,
  justification: true,
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
  if (actor.role === "DEPARTMENT_HEAD") where.assignedApproverId = actorId;
  if (options.status) where.status = options.status;
  if (options.vehicleId) where.vehicleId = options.vehicleId;
  if (options.kind) where.kind = options.kind;
  const bookings = await prisma.booking.findMany({
    where,
    select: {
      ...bookingSelect,
      vehicle: { select: { id: true, registration: true, make: true, model: true } },
      requestedBy: { select: { id: true, name: true, email: true, departmentId: true } },
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
    select: { id: true, sector: true, package: true },
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

  const booking = await prisma.booking.create({
    data: {
      tenantId,
      vehicleId: data.vehicleId,
      requestedById,
      assignedApproverId: initialApprover?.id || null,
      kind,
      status: "PENDING",
      justification,
      passengerCount,
      startAt,
      endAt,
      approvalTrail,
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

async function approveBooking(tenantId, bookingId, approver) {
  try {
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
      select: { id: true, sector: true, package: true },
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

        await lockVehicleForUpdate(tx, tenantId, pending.vehicleId);

        const conflicts = await tx.booking.findMany({
          where: {
            tenantId,
            vehicleId: pending.vehicleId,
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
          auto: false,
        });

        const nextApprover = await resolveNextApprover({
          tenant,
          currentApproverRole: approverRecord.role,
          tenantId,
        });

        const updateData = {
          approvalTrail: { push: approvalEvent },
        };

        if (nextApprover) {
          updateData.assignedApproverId = nextApprover.id;
        } else {
          updateData.status = "APPROVED";
          updateData.approvedAt = new Date();
        }

        return tx.booking.update({
          where: { id: pending.id },
          data: updateData,
          select: bookingSelect,
        });
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

module.exports = {
  bookingSelect,
  listBookings,
  createBooking,
  approveBooking,
  rejectBooking,
  serializeBooking,
  canTransition,
  parseJustification,
  parseComment,
  parsePassengerCount,
  TERMINAL_STATUSES,
};
