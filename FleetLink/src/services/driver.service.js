const prisma = require("../config/prisma");
const { encryptText, decryptText, stableHash } = require("../utils/crypto");

function serializeDriver(driver) {
  return driver ? { ...driver, licenseNumber: decryptText(driver.licenseNumber), licenseNumberHash: undefined } : driver;
}

async function createDriver(tenantId, data) {
  const { name, licenseNumber, cdlClass, coiExpiry, employmentStatus, contact, userId } = data;

  if (!name || !licenseNumber) {
    throw new Error("Missing required driver fields: name and licenseNumber");
  }

  const licenseNumberHash = stableHash(licenseNumber);
  const existing = await prisma.driver.findFirst({
    where: { tenantId, licenseNumberHash },
  });

  if (existing) {
    throw new Error(`Driver with license number ${licenseNumber} already exists for this tenant`);
  }

  return prisma.driver.create({
    data: {
      tenantId,
      name,
      licenseNumber: encryptText(licenseNumber),
      licenseNumberHash,
      cdlClass: cdlClass || null,
      coiExpiry: coiExpiry ? new Date(coiExpiry) : null,
      employmentStatus: employmentStatus || "ACTIVE",
      contact: contact || null,
      userId: userId || null,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  }).then(serializeDriver);
}

async function listDrivers(tenantId, query = {}) {
  const { employmentStatus, search } = query;

  const where = {
    tenantId,
    ...(employmentStatus ? { employmentStatus } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const drivers = await prisma.driver.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { trips: true, bookings: true } },
    },
    orderBy: { name: "asc" },
  });
  const needle = search?.trim().toLowerCase();
  return drivers.map(serializeDriver).filter((driver) => !needle || driver.name.toLowerCase().includes(needle) || driver.licenseNumber.toLowerCase().includes(needle));
}

async function listAssignableDrivers(tenantId) {
  return prisma.driver.findMany({
    where: { tenantId, employmentStatus: "ACTIVE" },
    select: { id: true, name: true },
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

  return serializeDriver(driver);
}

async function updateDriver(tenantId, id, data) {
  const existing = await getDriverById(tenantId, id);

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.licenseNumber !== undefined) {
    const licenseNumberHash = stableHash(data.licenseNumber);
    const duplicate = await prisma.driver.findFirst({ where: { tenantId, licenseNumberHash, id: { not: id } }, select: { id: true } });
    if (duplicate) throw new Error("A driver with this licence number already exists for this tenant");
    updateData.licenseNumber = encryptText(data.licenseNumber);
    updateData.licenseNumberHash = licenseNumberHash;
  }
  if (data.cdlClass !== undefined) updateData.cdlClass = data.cdlClass;
  if (data.coiExpiry !== undefined) updateData.coiExpiry = data.coiExpiry ? new Date(data.coiExpiry) : null;
  if (data.employmentStatus !== undefined) updateData.employmentStatus = data.employmentStatus;
  if (data.contact !== undefined) updateData.contact = data.contact;
  if (data.userId !== undefined) updateData.userId = data.userId;

  return prisma.driver.update({
    where: { id: existing.id },
    data: updateData,
    include: { user: { select: { id: true, name: true, email: true } } },
  }).then(serializeDriver);
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
  listAssignableDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
  getDriverTripHistory,
};
