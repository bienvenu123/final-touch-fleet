const prisma = require("../config/prisma");
const { parseAvailabilityWindow, toUtcIso8601 } = require("../utils/time-range-overlap");

const BLOCKING_BOOKING_STATUSES = ["APPROVED"];

async function findOverlappingApprovedBookings(tenantId, startAt, endAt, options = {}) {
  const { vehicleId, excludeBookingId } = options;

  return prisma.booking.findMany({
    where: {
      tenantId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      status: { in: BLOCKING_BOOKING_STATUSES },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: {
      id: true,
      vehicleId: true,
      kind: true,
      status: true,
      startAt: true,
      endAt: true,
    },
  });
}

async function findAvailableVehicles(tenantId, query = {}) {
  const { startAt, endAt } = parseAvailabilityWindow(query);
  const overlappingBookings = await findOverlappingApprovedBookings(tenantId, startAt, endAt);
  const blockedVehicleIds = [...new Set(overlappingBookings.map((booking) => booking.vehicleId))];

  const vehicles = await prisma.vehicle.findMany({
    where: {
      tenantId,
      retiredAt: null,
      ...(blockedVehicleIds.length ? { id: { notIn: blockedVehicleIds } } : {}),
    },
    orderBy: { registration: "asc" },
  });

  return {
    window: {
      start: toUtcIso8601(startAt),
      end: toUtcIso8601(endAt),
    },
    vehicles,
    excludedVehicleCount: blockedVehicleIds.length,
  };
}

module.exports = {
  BLOCKING_BOOKING_STATUSES,
  findOverlappingApprovedBookings,
  findAvailableVehicles,
};
