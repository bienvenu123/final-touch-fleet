const prisma = require("../config/prisma");

async function createDriver(tenantId, data) {
  const { name, licenseNumber, cdlClass, coiExpiry, employmentStatus, contact, userId } = data;

  if (!name || !licenseNumber) {
    throw new Error("Missing required driver fields: name and licenseNumber");
  }

  const existing = await prisma.driver.findFirst({
    where: { tenantId, licenseNumber },
  });

  if (existing) {
    throw new Error(`Driver with license number ${licenseNumber} already exists for this tenant`);
  }

  return prisma.driver.create({
    data: {
      tenantId,
      name,
      licenseNumber,
      cdlClass: cdlClass || null,
      coiExpiry: coiExpiry ? new Date(coiExpiry) : null,
      employmentStatus: employmentStatus || "ACTIVE",
      contact: contact || null,
      userId: userId || null,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

async function listDrivers(tenantId, query = {}) {
  const { employmentStatus, search } = query;

  const where = {
    tenantId,
    ...(employmentStatus ? { employmentStatus } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { licenseNumber: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return prisma.driver.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { trips: true, bookings: true } },
    },
    orderBy: { name: "asc" },
  });
}

async function getDriverById(tenantId, id) {
  const driver = await prisma.driver.findFirst({
    where: { id, tenantId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      bookings: { take: 5, orderBy: { createdAt: "desc" } },
      trips: { take: 5, orderBy: { createdAt: "desc" } },
    },
  });

  if (!driver) {
    throw new Error("Driver not found");
  }

  return driver;
}

async function updateDriver(tenantId, id, data) {
  const existing = await getDriverById(tenantId, id);

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.licenseNumber !== undefined) updateData.licenseNumber = data.licenseNumber;
  if (data.cdlClass !== undefined) updateData.cdlClass = data.cdlClass;
  if (data.coiExpiry !== undefined) updateData.coiExpiry = data.coiExpiry ? new Date(data.coiExpiry) : null;
  if (data.employmentStatus !== undefined) updateData.employmentStatus = data.employmentStatus;
  if (data.contact !== undefined) updateData.contact = data.contact;
  if (data.userId !== undefined) updateData.userId = data.userId;

  return prisma.driver.update({
    where: { id: existing.id },
    data: updateData,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

async function deleteDriver(tenantId, id) {
  const existing = await getDriverById(tenantId, id);
  return prisma.driver.delete({ where: { id: existing.id } });
}

async function getDriverTripHistory(tenantId, driverId) {
  await getDriverById(tenantId, driverId);

  return prisma.trip.findMany({
    where: { tenantId, driverId },
    include: {
      vehicle: { select: { id: true, registration: true, make: true, model: true } },
      booking: { select: { id: true, justification: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

module.exports = {
  createDriver,
  listDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
  getDriverTripHistory,
};
