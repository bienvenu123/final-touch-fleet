const prisma = require("../config/prisma");

function parseDateFilter(value) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
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
  const reservations = await prisma.rentalReservation.findMany({
    where: {
      tenantId,
      status: "COMPLETED",
      startAt: dateFilter,
      endAt: dateFilter,
    },
    include: {
      vehicle: { select: { registration: true, make: true, model: true } },
      inspections: {
        where: { inspectionType: "CHECKIN" },
        select: { distanceDriven: true },
      },
    },
  });

  if (!reservations.length) {
    return [];
  }

  const rangeDurationMs = dateFilter && dateFilter.gte && dateFilter.lte
    ? new Date(end).getTime() - new Date(start).getTime()
    : null;

  const grouped = reservations.reduce((acc, reservation) => {
    const key = reservation.vehicleId;
    const durationMs = Math.max(0, new Date(reservation.endAt).getTime() - new Date(reservation.startAt).getTime());
    const distance = reservation.inspections.reduce((sum, inspection) => sum + Number(inspection.distanceDriven || 0), 0);
    if (!acc[key]) {
      acc[key] = {
        vehicleId: reservation.vehicleId,
        registration: reservation.vehicle?.registration || null,
        make: reservation.vehicle?.make || null,
        model: reservation.vehicle?.model || null,
        tripCount: 0,
        totalDurationMs: 0,
        totalDistance: 0,
      };
    }
    acc[key].tripCount += 1;
    acc[key].totalDurationMs += durationMs;
    acc[key].totalDistance += distance;
    return acc;
  }, {});

  return Object.values(grouped).map((item) => ({
    ...item,
    idleTimeMs: rangeDurationMs !== null ? Math.max(0, rangeDurationMs - item.totalDurationMs) : 0,
    averageTripDurationMs: item.tripCount ? Math.round(item.totalDurationMs / item.tripCount) : 0,
  }));
}

async function getDepartmentRoi(tenantId, { start, end } = {}) {
  const dateFilter = buildDateRangeFilter(start, end);

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      status: "APPROVED",
      createdAt: dateFilter,
    },
    select: {
      vehicle: { select: { departmentId: true } },
      justification: true,
      comment: true,
      passengerCount: true,
      startAt: true,
      endAt: true,
    },
  });

  const departments = await prisma.department.findMany({
    where: { tenantId },
    select: { id: true, name: true, costCentreCode: true, budgetCode: true },
  });

  const lookup = departments.reduce((acc, dept) => {
    acc[dept.id] = dept;
    return acc;
  }, {});

  const results = {};

  bookings.forEach((booking) => {
    const departmentId = booking.vehicle?.departmentId;
    if (!departmentId || !lookup[departmentId]) return;

    const purpose = booking.comment?.trim() || booking.justification?.trim() || "Unspecified";
    const key = `${departmentId}::${purpose}`;
    const durationHours = Math.max(0, new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) / (60 * 60 * 1000);
    const revenue = Number(booking.passengerCount) * 10;
    const cost = durationHours * 20;

    if (!results[key]) {
      results[key] = {
        departmentId,
        departmentName: lookup[departmentId].name,
        costCentreCode: lookup[departmentId].costCentreCode,
        budgetCode: lookup[departmentId].budgetCode,
        purpose,
        totalBookings: 0,
        totalTrips: 0,
        totalRevenue: 0,
        totalCost: 0,
      };
    }

    results[key].totalBookings += 1;
    results[key].totalTrips += 1;
    results[key].totalRevenue += revenue;
    results[key].totalCost += cost;
  });

  return Object.values(results).map((row) => ({
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    costCentreCode: row.costCentreCode,
    budgetCode: row.budgetCode,
    purpose: row.purpose,
    totalBookings: row.totalBookings,
    totalTrips: row.totalTrips,
    totalRevenue: Number(row.totalRevenue.toFixed(2)),
    totalCost: Number(row.totalCost.toFixed(2)),
    roi: row.totalCost ? Number(((row.totalRevenue - row.totalCost) / row.totalCost).toFixed(4)) : 0,
  }));
}

async function getTopRequesters(tenantId, { start, end, limit = 10 } = {}) {
  const dateFilter = buildDateRangeFilter(start, end);

  const bookings = await prisma.booking.groupBy({
    by: ["requestedById"],
    where: {
      tenantId,
      status: "APPROVED",
      createdAt: dateFilter,
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: Number(limit),
  });

  if (!bookings.length) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: bookings.map((item) => item.requestedById) } },
    select: { id: true, name: true, email: true },
  });

  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});

  return bookings.map((item) => ({
    requesterId: item.requestedById,
    requester: userMap[item.requestedById] || null,
    requestCount: item._count.id,
  }));
}

module.exports = {
  getVehicleUtilization,
  getDepartmentRoi,
  getTopRequesters,
};
