const prisma = require("../config/prisma");

function parseDateFilter(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildDateRangeFilter(start, end) {
  const condition = {};
  const startDate = parseDateFilter(start);
  const endDate = parseDateFilter(end);
  if (startDate) condition.gte = startDate;
  if (endDate) condition.lte = endDate;
  return Object.keys(condition).length ? condition : undefined;
}

function safeDivide(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : 0;
}

function normalizeEnergy(value) {
  if (value == null) return null;
  return Number(value);
}

async function getFuelEnergyEfficiency(tenantId, { start, end } = {}) {
  const dateFilter = buildDateRangeFilter(start, end);

  const reservations = await prisma.rentalReservation.findMany({
    where: {
      tenantId,
      status: "COMPLETED",
      startAt: dateFilter,
      endAt: dateFilter,
    },
    include: {
      vehicle: { select: { id: true, registration: true, make: true, model: true } },
      customer: { select: { id: true, name: true } },
      inspections: {
        where: { inspectionType: "CHECKIN" },
        select: {
          odometerReading: true,
          fuelLevel: true,
          chargeLevel: true,
          fuelShortfall: true,
          chargeShortfall: true,
          distanceDriven: true,
        },
      },
    },
  });

  const rows = reservations.map((reservation) => {
    const inspection = reservation.inspections[0] || {};
    const drivenKm = Number(inspection.distanceDriven || 0);
    const fuelConsumed = normalizeEnergy(inspection.fuelShortfall);
    const energyConsumed = normalizeEnergy(inspection.chargeShortfall);

    const hasFuelData = fuelConsumed != null && drivenKm > 0;
    const hasChargeData = energyConsumed != null && drivenKm > 0;
    const hasAnyData = hasFuelData || hasChargeData;

    const fuelRate = hasFuelData ? safeDivide(100 * fuelConsumed, drivenKm) : null;
    const chargeRate = hasChargeData ? safeDivide(100 * energyConsumed, drivenKm) : null;
    const missingEndLog = !inspection.id || drivenKm === 0 || !hasAnyData;

    const fuelLeakage = hasFuelData && fuelRate > 25;
    const chargeLeakage = hasChargeData && chargeRate > 35;
    const energyMode = hasChargeData ? (hasFuelData ? "HYBRID" : "ELECTRIC") : "FUEL";

    return {
      reservationId: reservation.id,
      vehicleId: reservation.vehicle.id,
      vehicleRegistration: reservation.vehicle.registration,
      customerId: reservation.customer?.id || null,
      customerName: reservation.customer?.name || null,
      energyMode,
      drivenKm,
      fuelConsumedLiters: fuelConsumed,
      energyConsumedkWh: energyConsumed,
      fuelConsumptionLPer100Km: fuelRate,
      energyConsumptionkWhPer100Km: chargeRate,
      fuelLeakage,
      chargeLeakage,
      missingEndLog,
      rawFuelLevel: normalizeEnergy(inspection.fuelLevel),
      rawChargeLevel: normalizeEnergy(inspection.chargeLevel),
    };
  });

  const perVehicle = {};
  const perDriver = {};

  rows.forEach((row) => {
    const vkey = row.vehicleId;
    if (!perVehicle[vkey]) {
      perVehicle[vkey] = {
        vehicleId: row.vehicleId,
        vehicleRegistration: row.vehicleRegistration,
        totalTrips: 0,
        totalDrivenKm: 0,
        totalFuel: 0,
        totalCharge: 0,
        fuelSamples: 0,
        chargeSamples: 0,
        fuelLeakages: 0,
        chargeLeakages: 0,
        missingEndLogs: 0,
      };
    }
    const vehicle = perVehicle[vkey];
    vehicle.totalTrips += 1;
    vehicle.totalDrivenKm += row.drivenKm;
    if (row.fuelConsumptionLPer100Km != null) {
      vehicle.totalFuel += row.fuelConsumptionLPer100Km;
      vehicle.fuelSamples += 1;
    }
    if (row.energyConsumptionkWhPer100Km != null) {
      vehicle.totalCharge += row.energyConsumptionkWhPer100Km;
      vehicle.chargeSamples += 1;
    }
    if (row.fuelLeakage) vehicle.fuelLeakages += 1;
    if (row.chargeLeakage) vehicle.chargeLeakages += 1;
    if (row.missingEndLog) vehicle.missingEndLogs += 1;

    const dkey = row.customerId || "unknown";
    if (!perDriver[dkey]) {
      perDriver[dkey] = {
        driverId: row.customerId,
        driverName: row.customerName,
        totalTrips: 0,
        totalDrivenKm: 0,
        totalFuel: 0,
        totalCharge: 0,
        fuelSamples: 0,
        chargeSamples: 0,
        fuelLeakages: 0,
        chargeLeakages: 0,
        missingEndLogs: 0,
      };
    }
    const driver = perDriver[dkey];
    driver.totalTrips += 1;
    driver.totalDrivenKm += row.drivenKm;
    if (row.fuelConsumptionLPer100Km != null) {
      driver.totalFuel += row.fuelConsumptionLPer100Km;
      driver.fuelSamples += 1;
    }
    if (row.energyConsumptionkWhPer100Km != null) {
      driver.totalCharge += row.energyConsumptionkWhPer100Km;
      driver.chargeSamples += 1;
    }
    if (row.fuelLeakage) driver.fuelLeakages += 1;
    if (row.chargeLeakage) driver.chargeLeakages += 1;
    if (row.missingEndLog) driver.missingEndLogs += 1;
  });

  return {
    vehicleTrends: Object.values(perVehicle).map((vehicle) => ({
      ...vehicle,
      averageFuelLPer100Km: vehicle.fuelSamples ? Number((vehicle.totalFuel / vehicle.fuelSamples).toFixed(4)) : 0,
      averageEnergykWhPer100Km: vehicle.chargeSamples ? Number((vehicle.totalCharge / vehicle.chargeSamples).toFixed(4)) : 0,
      fuelLeakageRatio: safeDivide(vehicle.fuelLeakages, vehicle.totalTrips),
      chargeLeakageRatio: safeDivide(vehicle.chargeLeakages, vehicle.totalTrips),
      missingEndLogRatio: safeDivide(vehicle.missingEndLogs, vehicle.totalTrips),
    })),
    driverTrends: Object.values(perDriver).map((driver) => ({
      ...driver,
      averageFuelLPer100Km: driver.fuelSamples ? Number((driver.totalFuel / driver.fuelSamples).toFixed(4)) : 0,
      averageEnergykWhPer100Km: driver.chargeSamples ? Number((driver.totalCharge / driver.chargeSamples).toFixed(4)) : 0,
      fuelLeakageRatio: safeDivide(driver.fuelLeakages, driver.totalTrips),
      chargeLeakageRatio: safeDivide(driver.chargeLeakages, driver.totalTrips),
      missingEndLogRatio: safeDivide(driver.missingEndLogs, driver.totalTrips),
    })),
    rows,
  };
}

async function getMaintenanceCompliance(tenantId, { start, end } = {}) {
  const dateFilter = buildDateRangeFilter(start, end);

  const services = await prisma.serviceRecord.findMany({
    where: {
      vehicle: { tenantId },
      serviceDate: dateFilter,
    },
    select: {
      id: true,
      vehicleId: true,
      serviceDate: true,
      nextDueDate: true,
      nextDueMileage: true,
      odometerMileage: true,
      vehicle: { select: { id: true, registration: true, odometerCurrent: true } },
    },
  });

  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId },
    select: { id: true, registration: true, odometerCurrent: true, nextDueDate: true, nextDueMileage: true },
  });

  const vehicleMap = vehicles.reduce((acc, vehicle) => {
    acc[vehicle.id] = vehicle;
    return acc;
  }, {});

  const compliance = services.map((service) => {
    const vehicle = vehicleMap[service.vehicleId];
    const onTimeDate = service.nextDueDate ? service.nextDueDate >= service.serviceDate : true;
    const onTimeMileage = service.nextDueMileage != null ? service.nextDueMileage >= service.odometerMileage : true;
    return {
      serviceId: service.id,
      vehicleId: service.vehicleId,
      vehicleRegistration: vehicle?.registration || null,
      serviceDate: service.serviceDate,
      dueDate: service.nextDueDate,
      dueMileage: service.nextDueMileage,
      currentOdometer: vehicle?.odometerCurrent ?? null,
      onTimeDate,
      onTimeMileage,
      compliance: onTimeDate && onTimeMileage ? 1 : 0,
    };
  });

  const grouped = services.reduce((acc, service) => {
    const vehicle = vehicleMap[service.vehicleId];
    const key = vehicle ? vehicle.id : "unknown";
    if (!acc[key]) {
      acc[key] = {
        vehicleId: key,
        registration: vehicle?.registration || null,
        totalServices: 0,
        compliantServices: 0,
      };
    }
    const onTimeDate = service.nextDueDate ? service.nextDueDate >= service.serviceDate : true;
    const onTimeMileage = service.nextDueMileage != null ? service.nextDueMileage >= service.odometerMileage : true;
    acc[key].totalServices += 1;
    if (onTimeDate && onTimeMileage) acc[key].compliantServices += 1;
    return acc;
  }, {});

  const vehicleCompliance = Object.values(grouped).map((item) => ({
    ...item,
    complianceRatio: safeDivide(item.compliantServices, item.totalServices),
  }));

  const overallComplianceRatio = safeDivide(
    vehicleCompliance.reduce((sum, item) => sum + item.complianceRatio * item.totalServices, 0),
    vehicleCompliance.reduce((sum, item) => sum + item.totalServices, 0)
  );

  return {
    overallComplianceRatio,
    vehicleCompliance,
    serviceRows: compliance,
  };
}

module.exports = {
  getFuelEnergyEfficiency,
  getMaintenanceCompliance,
};
