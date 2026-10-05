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

async function getVehicleUtilization(tenantId, { start, end } = {}) {
  const dateFilter = buildDateRangeFilter(start, end);
  const startDate = parseDateFilter(start), endDate = parseDateFilter(end);
  const tripRange = startDate && endDate
    ? { startAt: { lt: endDate }, endAt: { gt: startDate } }
    : dateFilter ? { endAt: dateFilter } : {};
  const bookingRange = startDate && endDate
    ? { startAt: { lt: endDate }, endAt: { gt: startDate } }
    : startDate ? { endAt: { gte: startDate } }
    : endDate ? { startAt: { lte: endDate } } : {};
  const [vehicles, trips, bookings] = await Promise.all([
    prisma.vehicle.findMany({ where: { tenantId, retiredAt: null }, select: { id: true, registration: true, make: true, model: true } }),
    prisma.trip.findMany({
      where: { tenantId, status: "COMPLETED", ...tripRange },
      select: { id: true, vehicleId: true, startAt: true, endAt: true, distanceDriven: true },
    }),
    prisma.booking.findMany({
      where: { tenantId, status: "APPROVED", ...bookingRange },
      select: { vehicleId: true, startAt: true, endAt: true },
    }),
  ]);
  const byVehicle = new Map(vehicles.map(vehicle => [vehicle.id, {
    vehicleId: vehicle.id, registration: vehicle.registration, make: vehicle.make, model: vehicle.model,
    tripCount: 0, totalDurationMs: 0, totalTripDurationMs: 0, totalDistance: 0,
  }]));
  for (const trip of trips) {
    const row = byVehicle.get(trip.vehicleId);
    if (!row) continue;
    row.tripCount += 1;
    row.totalDistance += Number(trip.distanceDriven || 0);
    if (trip.startAt && trip.endAt) row.totalTripDurationMs += Math.max(0, trip.endAt.getTime() - trip.startAt.getTime());
  }
  const rangeDurationMs = startDate && endDate ? Math.max(0, endDate.getTime() - startDate.getTime()) : null;
  // Merge overlapping trip intervals so concurrent/overlapping records never
  // make a vehicle appear busier than the selected period.
  for (const row of byVehicle.values()) {
    const intervals = [...trips, ...bookings].filter(t => t.vehicleId === row.vehicleId && t.startAt && t.endAt && (!startDate || t.endAt > startDate) && (!endDate || t.startAt < endDate))
      .map(t => [Math.max(startDate?.getTime() ?? t.startAt.getTime(), t.startAt.getTime()), Math.min(endDate?.getTime() ?? t.endAt.getTime(), t.endAt.getTime())])
      .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    let busy = 0, left = null, right = null;
    for (const [a, b] of intervals) { if (left === null) { left = a; right = b; } else if (a <= right) right = Math.max(right, b); else { busy += right - left; left = a; right = b; } }
    if (left !== null) busy += right - left;
    row.totalDurationMs = busy;
  }
  return [...byVehicle.values()].map(row => ({
    ...row,
    idleTimeMs: rangeDurationMs === null ? null : Math.max(0, rangeDurationMs - row.totalDurationMs),
    averageTripDurationMs: row.tripCount ? Math.round(row.totalTripDurationMs / row.tripCount) : 0,
  }));
}

async function getDepartmentRoi(tenantId, { start, end } = {}) {
  const dateFilter = buildDateRangeFilter(start, end);
  const [departments, vehicles, trips, serviceRecords] = await Promise.all([
    prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true, costCentreCode: true, budgetCode: true } }),
    prisma.vehicle.findMany({ where: { tenantId }, select: { id: true, departmentId: true } }),
    prisma.trip.findMany({
      where: { tenantId, status: "COMPLETED", ...(dateFilter ? { endAt: dateFilter } : {}) },
      select: { id: true, vehicleId: true, businessBenefit: true, booking: { select: { justification: true, purposeCategory: true, customData: true } }, fuelCost: true, energyCost: true, distanceDriven: true },
    }),
    prisma.serviceRecord.findMany({
      where: { vehicle: { tenantId }, ...(dateFilter ? { serviceDate: dateFilter } : {}) },
      select: { vehicleId: true, cost: true },
    }),
  ]);
  const departmentById = new Map(departments.map(department => [department.id, department]));
  const vehicleById = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
  const tripDistanceByVehicle = new Map();
  for (const trip of trips) tripDistanceByVehicle.set(trip.vehicleId, (tripDistanceByVehicle.get(trip.vehicleId) || 0) + Number(trip.distanceDriven || 0));
  const serviceCostByVehicle = new Map();
  for (const service of serviceRecords) serviceCostByVehicle.set(service.vehicleId, (serviceCostByVehicle.get(service.vehicleId) || 0) + Number(service.cost || 0));
  const rows = new Map();
  for (const trip of trips) {
    const department = departmentById.get(vehicleById.get(trip.vehicleId)?.departmentId);
    if (!department) continue;
    const purpose = trip.booking?.purposeCategory?.trim() || trip.booking?.justification?.trim() || "Unspecified";
    const key = `${department.id}::${purpose}`;
    const distance = Number(trip.distanceDriven || 0);
    const vehicleDistance = tripDistanceByVehicle.get(trip.vehicleId) || 0;
    const maintenanceCost = vehicleDistance > 0
      ? (serviceCostByVehicle.get(trip.vehicleId) || 0) * distance / vehicleDistance
      : 0;
    const fuelCost = Number(trip.fuelCost || 0), energyCost = Number(trip.energyCost || 0);
    if (!rows.has(key)) rows.set(key, {
      departmentId: department.id, departmentName: department.name, costCentreCode: department.costCentreCode,
      budgetCode: department.budgetCode, purpose, totalTrips: 0, totalDistanceKm: 0,
      totalFuelCost: 0, totalEnergyCost: 0, allocatedMaintenanceCost: 0, recordedBusinessBenefit: 0, benefitSamples: 0,
      bookingCustomFields: [],
    });
    const row = rows.get(key);
    row.totalTrips += 1;
    row.totalDistanceKm += distance;
    if (trip.booking?.customData) row.bookingCustomFields.push(trip.booking.customData);
    row.totalFuelCost += fuelCost;
    row.totalEnergyCost += energyCost;
    row.allocatedMaintenanceCost += maintenanceCost;
    if (trip.businessBenefit != null) { row.recordedBusinessBenefit += Number(trip.businessBenefit); row.benefitSamples += 1; }
  }
  return [...rows.values()].map(row => {
    const totalCost = row.totalFuelCost + row.totalEnergyCost + row.allocatedMaintenanceCost;
    return {
      ...row,
      totalDistanceKm: Number(row.totalDistanceKm.toFixed(1)),
      totalFuelCost: Number(row.totalFuelCost.toFixed(2)),
      totalEnergyCost: Number(row.totalEnergyCost.toFixed(2)),
      allocatedMaintenanceCost: Number(row.allocatedMaintenanceCost.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      recordedBusinessBenefit: Number(row.recordedBusinessBenefit.toFixed(2)),
      benefitSamples: row.benefitSamples,
      roi: row.benefitSamples && totalCost > 0 ? Number(((row.recordedBusinessBenefit - totalCost) * 100 / totalCost).toFixed(2)) : null,
      roiUnavailableReason: row.benefitSamples ? (totalCost > 0 ? null : "No costs were recorded for this department and period.") : "Business benefit or savings are not recorded for completed trips.",
    };
  });
}

async function getTopRequesters(tenantId, { start, end, limit = 10 } = {}) {
  const dateFilter = buildDateRangeFilter(start, end);
  const trips = await prisma.trip.findMany({
    where: { tenantId, status: "COMPLETED", ...(dateFilter ? { endAt: dateFilter } : {}), bookingId: { not: null } },
    select: { booking: { select: { requestedById: true } }, distanceDriven: true, fuelCost: true, energyCost: true },
  });
  const stats = new Map();
  for (const trip of trips) {
    const userId = trip.booking?.requestedById;
    if (!userId) continue;
    const row = stats.get(userId) || { requestCount: 0, totalDistanceKm: 0, totalCost: 0 };
    row.requestCount += 1;
    row.totalDistanceKm += Number(trip.distanceDriven || 0);
    row.totalCost += Number(trip.fuelCost || 0) + Number(trip.energyCost || 0);
    stats.set(userId, row);
  }
  const ranked = [...stats.entries()].sort((a, b) => b[1].requestCount - a[1].requestCount).slice(0, Math.max(1, Math.min(100, Number(limit) || 10)));
  const users = await prisma.user.findMany({ where: { id: { in: ranked.map(([id]) => id) }, tenantId }, select: { id: true, name: true, email: true } });
  const byId = new Map(users.map(user => [user.id, user]));
  return ranked.map(([requesterId, row]) => ({ requesterId, requester: byId.get(requesterId) || null,
    requestCount: row.requestCount, totalDistanceKm: Number(row.totalDistanceKm.toFixed(1)), totalCost: Number(row.totalCost.toFixed(2)) }));
}

module.exports = { getVehicleUtilization, getDepartmentRoi, getTopRequesters };
