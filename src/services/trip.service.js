const prisma = require("../config/prisma");

async function createTrip(tenantId, data) {
  const { bookingId, reservationId, vehicleId, driverId, startOdometer, fuelStart, chargeStart, routeData } = data;

  if (!vehicleId) {
    throw new Error("vehicleId is required to create a trip");
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
  });

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  const initialOdometer = startOdometer !== undefined ? Number(startOdometer) : vehicle.odometerCurrent;

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

  const startOdometer = data.startOdometer !== undefined ? Number(data.startOdometer) : (trip.startOdometer || trip.vehicle.odometerCurrent);

  await prisma.$transaction([
    prisma.trip.update({
      where: { id: tripId },
      data: {
        status: "ONGOING",
        startAt: new Date(),
        startOdometer,
        fuelStart: data.fuelStart !== undefined ? data.fuelStart : trip.fuelStart,
        chargeStart: data.chargeStart !== undefined ? data.chargeStart : trip.chargeStart,
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

  const endOdometer = data.endOdometer !== undefined ? Number(data.endOdometer) : (trip.vehicle.odometerCurrent + 10);
  const startOdometer = trip.startOdometer || trip.vehicle.odometerCurrent;
  const distanceDriven = Math.max(0, endOdometer - startOdometer);

  await prisma.$transaction([
    prisma.trip.update({
      where: { id: tripId },
      data: {
        status: "COMPLETED",
        endAt: new Date(),
        endOdometer,
        distanceDriven,
        fuelEnd: data.fuelEnd !== undefined ? data.fuelEnd : null,
        chargeEnd: data.chargeEnd !== undefined ? data.chargeEnd : null,
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
