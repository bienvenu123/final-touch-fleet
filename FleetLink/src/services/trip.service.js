const prisma = require("../config/prisma");
const { validationError, nonNegativeInteger, level, checklist } = require("./trip.validation");
const { validateEntityCustomData } = require("./custom-fields.service");
function syncEvent(trip, operationId) { return operationId ? [...(Array.isArray(trip.syncEvents) ? trip.syncEvents : []), { operationId, at: new Date().toISOString() }].slice(-100) : trip.syncEvents; }

async function createTrip(tenantId, data) {
  const { bookingId, reservationId, vehicleId, driverId, startOdometer, fuelStart, chargeStart, routeData } = data;
  const customData = await validateEntityCustomData(tenantId, "trip", data.customData || {});

  if (!vehicleId) {
    throw new Error("vehicleId is required to create a trip");
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
  });

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  const initialOdometer = startOdometer !== undefined ? nonNegativeInteger(startOdometer, "startOdometer") : vehicle.odometerCurrent;

  return prisma.trip.create({
    data: {
      tenantId,
      bookingId: bookingId || null,
      reservationId: reservationId || null,
      vehicleId,
      driverId: driverId || null,
      status: "PLANNED",
      startOdometer: initialOdometer,
      fuelStart: fuelStart !== undefined ? fuelStart : null,
      chargeStart: chargeStart !== undefined ? chargeStart : null,
      routeData: routeData || null,
      customData,
    },
    include: {
      vehicle: { select: { id: true, registration: true, make: true, model: true, odometerCurrent: true, status: true } },
      driver: { select: { id: true, name: true, licenseNumber: true } },
      booking: { select: { id: true, justification: true } },
    },
  });
}

async function startTrip(tenantId, tripId, data = {}) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, tenantId },
    include: { vehicle: true },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  if (trip.status === "ONGOING") {
    return getTripById(tenantId, tripId);
  }
  if (trip.status !== "PLANNED") throw validationError("Only planned trips can be started");

  const startOdometer = data.startOdometer !== undefined ? nonNegativeInteger(data.startOdometer, "startOdometer") : (trip.startOdometer ?? trip.vehicle.odometerCurrent);
  if (startOdometer < trip.vehicle.odometerCurrent) throw validationError("startOdometer cannot be lower than the vehicle odometer");
  const startChecklist = checklist(data.startChecklist, "startChecklist");

  await prisma.$transaction([
    prisma.trip.update({
      where: { id: tripId },
      data: {
        status: "ONGOING",
        startAt: new Date(),
        startOdometer,
        fuelStart: data.fuelStart !== undefined ? data.fuelStart : trip.fuelStart,
        chargeStart: data.chargeStart !== undefined ? data.chargeStart : trip.chargeStart,
        startChecklist,
        syncEvents: syncEvent(trip, data.operationId),
      },
    }),
    prisma.vehicle.update({
      where: { id: trip.vehicleId },
      data: { status: "ON_TRIP" },
    }),
  ]);

  return getTripById(tenantId, tripId);
}

async function endTrip(tenantId, tripId, data = {}) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, tenantId },
    include: { vehicle: true },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }
  if (trip.status === "COMPLETED") return getTripById(tenantId, tripId);
  if (trip.status !== "ONGOING") throw validationError("Only ongoing trips can be ended");

  const endOdometer = nonNegativeInteger(data.endOdometer, "endOdometer");
  const startOdometer = trip.startOdometer ?? trip.vehicle.odometerCurrent;
  if (endOdometer < startOdometer || endOdometer < trip.vehicle.odometerCurrent) throw validationError("endOdometer cannot be lower than the starting or recorded odometer");
  const distanceDriven = endOdometer - startOdometer;
  const endChecklist = checklist(data.endChecklist, "endChecklist");

  await prisma.$transaction([
    prisma.trip.update({
      where: { id: tripId },
      data: {
        status: "COMPLETED",
        endAt: new Date(),
        endOdometer,
        distanceDriven,
        fuelEnd: level(data.fuelEnd, "fuelEnd"),
        chargeEnd: level(data.chargeEnd, "chargeEnd"),
        fuelCost: data.fuelCost === undefined || data.fuelCost === null || data.fuelCost === "" ? null : nonNegativeMoney(data.fuelCost, "fuelCost"),
        energyCost: data.energyCost === undefined || data.energyCost === null || data.energyCost === "" ? null : nonNegativeMoney(data.energyCost, "energyCost"),
        businessBenefit: data.businessBenefit === undefined || data.businessBenefit === null || data.businessBenefit === "" ? null : nonNegativeMoney(data.businessBenefit, "businessBenefit"),
        endChecklist,
        syncEvents: syncEvent(trip, data.operationId),
      },
    }),
    prisma.vehicle.update({
      where: { id: trip.vehicleId },
      data: {
        odometerCurrent: endOdometer,
        status: "AVAILABLE",
      },
    }),
  ]);

  return getTripById(tenantId, tripId);
}

function nonNegativeMoney(value, field) {
  const amount = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) throw validationError(`${field} must be a non-negative amount with at most two decimal places`);
  return amount;
}

async function listTrips(tenantId, query = {}) {
  const { status, vehicleId, driverId } = query;

  return prisma.trip.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
      ...(vehicleId ? { vehicleId } : {}),
      ...(driverId ? { driverId } : {}),
    },
    include: {
      vehicle: { select: { id: true, registration: true, make: true, model: true, status: true } },
      driver: { select: { id: true, name: true, licenseNumber: true } },
      booking: { select: { id: true, justification: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getTripById(tenantId, tripId) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, tenantId },
    include: {
      vehicle: { select: { id: true, registration: true, make: true, model: true, odometerCurrent: true, status: true } },
      driver: { select: { id: true, name: true, licenseNumber: true } },
      booking: { select: { id: true, justification: true } },
      reservation: { select: { id: true, agreedRate: true } },
    },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  return trip;
}

async function updateRoute(tenantId, tripId, routeData) {
  const trip = await getTripById(tenantId, tripId);
  return prisma.trip.update({
    where: { id: trip.id },
    data: { routeData },
  });
}

module.exports = {
  createTrip,
  startTrip,
  endTrip,
  listTrips,
  getTripById,
  updateRoute,
};
