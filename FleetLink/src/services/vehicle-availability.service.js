const prisma = require("../config/prisma");
const { parseAvailabilityWindow, toUtcIso8601 } = require("../utils/time-range-overlap");

// A pending request holds the requested vehicle immediately. This prevents a
// second customer from booking the same vehicle while the first request is
// awaiting approval.
const BLOCKING_BOOKING_STATUSES = ["PENDING", "APPROVED"];
const BLOCKING_RESERVATION_STATUSES = ["RESERVED", "ACTIVE"];
const NON_AVAILABLE_VEHICLE_STATUSES = ["IN_MAINTENANCE", "OUT_OF_SERVICE", "ON_TRIP"];

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

async function findOverlappingRentalReservations(tenantId, startAt, endAt, options = {}) {
  const { vehicleId, excludeReservationId } = options;

  return prisma.rentalReservation.findMany({
    where: {
      tenantId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      status: { in: BLOCKING_RESERVATION_STATUSES },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: {
      id: true,
      vehicleId: true,
      status: true,
      startAt: true,
      endAt: true,
    },
  });
}

async function findAvailableVehicles(tenantId, query = {}) {
  const { startAt, endAt } = parseAvailabilityWindow(query);

  const [overlappingBookings, overlappingReservations] = await Promise.all([
    findOverlappingApprovedBookings(tenantId, startAt, endAt),
    findOverlappingRentalReservations(tenantId, startAt, endAt),
  ]);

  const blockedVehicleIds = [
    ...new Set([
      ...overlappingBookings.map((b) => b.vehicleId),
      ...overlappingReservations.map((r) => r.vehicleId),
    ]),
  ];

  const vehicles = await prisma.vehicle.findMany({
    where: {
      tenantId,
      retiredAt: null,
      status: { notIn: NON_AVAILABLE_VEHICLE_STATUSES },
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
  BLOCKING_RESERVATION_STATUSES,
  NON_AVAILABLE_VEHICLE_STATUSES,
  findOverlappingApprovedBookings,
  findOverlappingRentalReservations,
  findAvailableVehicles,
};
