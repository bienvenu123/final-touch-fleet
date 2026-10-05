const prisma = require("../config/prisma");

function parseDateFilter(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
function buildDateRangeFilter(start, end) {
  const condition = {};
  const from = parseDateFilter(start), to = parseDateFilter(end);
  if (from) condition.gte = from;
  if (to) condition.lte = to;
  return Object.keys(condition).length ? condition : undefined;
}
function rate(consumed, distance) { return consumed == null || distance <= 0 ? null : Number((Number(consumed) * 100 / distance).toFixed(3)); }

async function getFuelEnergyEfficiency(tenantId, { start, end } = {}) {
  const dateFilter = buildDateRangeFilter(start, end);
  const trips = await prisma.trip.findMany({
    where: { tenantId, status: "COMPLETED", ...(dateFilter ? { endAt: dateFilter } : {}) },
    select: {
      id: true, vehicleId: true, driverId: true, customData: true, startOdometer: true, endOdometer: true, distanceDriven: true,
      fuelStart: true, fuelEnd: true, chargeStart: true, chargeEnd: true, fuelCost: true, energyCost: true,
      vehicle: { select: { registration: true } }, driver: { select: { id: true, name: true } },
    },
  });
  const rows = trips.map(trip => {
    const distance = Number(trip.distanceDriven || 0);
    const fuelConsumed = trip.fuelStart == null || trip.fuelEnd == null ? null : Math.max(0, Number(trip.fuelStart) - Number(trip.fuelEnd));
    const energyConsumed = trip.chargeStart == null || trip.chargeEnd == null ? null : Math.max(0, Number(trip.chargeStart) - Number(trip.chargeEnd));
    return {
      tripId: trip.id, vehicleId: trip.vehicleId, vehicleRegistration: trip.vehicle.registration,
      driverId: trip.driverId, driverName: trip.driver?.name || null, drivenKm: distance,
      customFields: trip.customData || {},
      fuelLevelDropPercentagePoints: fuelConsumed, chargeLevelDropPercentagePoints: energyConsumed,
      fuelLevelDropPer100Km: rate(fuelConsumed, distance), chargeDropPer100Km: rate(energyConsumed, distance),
      fuelCost: trip.fuelCost == null ? null : Number(trip.fuelCost),
      energyCost: trip.energyCost == null ? null : Number(trip.energyCost),
      missingStartOrEndLog: trip.startOdometer == null || trip.endOdometer == null ||
        (trip.fuelStart == null && trip.chargeStart == null) || (trip.fuelEnd == null && trip.chargeEnd == null),
    };
  });
  const aggregate = (key, labelKey) => {
    const groups = new Map();
    for (const row of rows) {
      const id = row[key] || "unassigned";
      const item = groups.get(id) || { id: row[key] || null, [labelKey]: row[key === "vehicleId" ? "vehicleRegistration" : "driverName"] || "Unassigned", trips: 0, drivenKm: 0, fuelLevelDrop: 0, fuelSamples: 0, chargeLevelDrop: 0, chargeSamples: 0, fuelCost: 0, fuelCostSamples: 0, energyCost: 0, energyCostSamples: 0, missingLogs: 0 };
      item.trips += 1; item.drivenKm += row.drivenKm;
      if (row.fuelLevelDropPercentagePoints != null) { item.fuelLevelDrop += row.fuelLevelDropPercentagePoints; item.fuelSamples += 1; }
      if (row.chargeLevelDropPercentagePoints != null) { item.chargeLevelDrop += row.chargeLevelDropPercentagePoints; item.chargeSamples += 1; }
      if (row.fuelCost != null) { item.fuelCost += row.fuelCost; item.fuelCostSamples += 1; }
      if (row.energyCost != null) { item.energyCost += row.energyCost; item.energyCostSamples += 1; }
      if (row.missingStartOrEndLog) item.missingLogs += 1;
      groups.set(id, item);
    }
    return [...groups.values()].map(item => ({ ...item,
      averageFuelLevelDropPer100Km: item.drivenKm > 0 ? Number((item.fuelLevelDrop * 100 / item.drivenKm).toFixed(3)) : null,
      averageChargeDropPer100Km: item.drivenKm > 0 ? Number((item.chargeLevelDrop * 100 / item.drivenKm).toFixed(3)) : null,
      totalFuelCost: Number(item.fuelCost.toFixed(2)), totalEnergyCost: Number(item.energyCost.toFixed(2)),
      tripsWithFuelCost: item.fuelCostSamples, tripsWithEnergyCost: item.energyCostSamples,
      missingLogCount: item.missingLogs,
    }));
  };
  return { vehicleTrends: aggregate("vehicleId", "vehicleRegistration"), driverTrends: aggregate("driverId", "driverName"), rows };
}

async function getMaintenanceCompliance(tenantId, { start, end } = {}) {
  const serviceFilter = buildDateRangeFilter(start, end);
  const [vehicles, records] = await Promise.all([
    prisma.vehicle.findMany({ where: { tenantId }, select: { id: true, registration: true, odometerCurrent: true, nextDueDate: true, nextDueMileage: true } }),
    prisma.serviceRecord.findMany({ where: { vehicle: { tenantId } }, orderBy: [{ vehicleId: "asc" }, { serviceDate: "asc" }], select: { id: true, vehicleId: true, serviceDate: true, odometerMileage: true, nextDueDate: true, nextDueMileage: true } }),
  ]);
  const vehicleById = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
  const byVehicle = new Map();
  for (const record of records) byVehicle.set(record.vehicleId, [...(byVehicle.get(record.vehicleId) || []), record]);
  const today = new Date();
  const serviceRows = [];
  for (const [vehicleId, vehicleRecords] of byVehicle) {
    const vehicle = vehicleById.get(vehicleId);
    vehicleRecords.forEach((record, index) => {
      const nextService = vehicleRecords[index + 1];
      let status = "NOT_SCHEDULED";
      if (record.nextDueDate || record.nextDueMileage != null) {
        const dateMet = !record.nextDueDate || (nextService ? nextService.serviceDate <= record.nextDueDate : today <= record.nextDueDate);
        const mileageMet = record.nextDueMileage == null || (nextService ? nextService.odometerMileage <= record.nextDueMileage : vehicle.odometerCurrent <= record.nextDueMileage);
        if (nextService && dateMet && mileageMet) status = "ON_TIME";
        else if (!dateMet || !mileageMet) status = "OVERDUE";
        else status = "NOT_DUE";
      }
      if (!serviceFilter || (record.serviceDate >= (serviceFilter.gte || new Date(0)) && record.serviceDate <= (serviceFilter.lte || new Date("9999-12-31")))) {
        serviceRows.push({ serviceId: record.id, vehicleId, vehicleRegistration: vehicle?.registration || null, serviceDate: record.serviceDate, nextDueDate: record.nextDueDate, nextDueMileage: record.nextDueMileage, nextServiceDate: nextService?.serviceDate || null, nextServiceMileage: nextService?.odometerMileage ?? null, status });
      }
    });
  }
  const vehicleCompliance = vehicles.map(vehicle => {
    const rows = serviceRows.filter(row => row.vehicleId === vehicle.id);
    const evaluated = rows.filter(row => ["ON_TIME", "OVERDUE"].includes(row.status));
    return { vehicleId: vehicle.id, registration: vehicle.registration, totalServices: rows.length,
      compliantServices: evaluated.filter(row => row.status === "ON_TIME").length,
      overdueServices: rows.filter(row => row.status === "OVERDUE").length,
      complianceRatio: evaluated.length ? Number((evaluated.filter(row => row.status === "ON_TIME").length / evaluated.length).toFixed(4)) : null };
  });
  const evaluated = serviceRows.filter(row => ["ON_TIME", "OVERDUE"].includes(row.status));
  return { overallComplianceRatio: evaluated.length ? Number((evaluated.filter(row => row.status === "ON_TIME").length / evaluated.length).toFixed(4)) : null, vehicleCompliance, serviceRows };
}

module.exports = { getFuelEnergyEfficiency, getMaintenanceCompliance };
