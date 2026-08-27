const prisma = require("../config/prisma");

const publicVehicleSelect = {
  id: true,
  registration: true,
  make: true,
  model: true,
  imageUrl: true,
  odometerCurrent: true,
  nextDueDate: true,
};

function publicTenantId() {
  const tenantId = process.env.PUBLIC_TENANT_ID?.trim();
  if (!tenantId) {
    const error = new Error("The public fleet is not configured");
    error.statusCode = 503;
    throw error;
  }
  return tenantId;
}

async function listPublicVehicles(query = {}) {
  const search = typeof query.search === "string" ? query.search.trim() : "";
  return prisma.vehicle.findMany({
    where: {
      tenantId: publicTenantId(),
      retiredAt: null,
      ...(search ? { OR: [
        { registration: { contains: search, mode: "insensitive" } },
        { make: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
      ] } : {}),
    },
    select: publicVehicleSelect,
    orderBy: { registration: "asc" },
  });
}

async function getPublicVehicle(vehicleId) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId: publicTenantId(), retiredAt: null },
    select: publicVehicleSelect,
  });
  if (!vehicle) {
    const error = new Error("Vehicle not found");
    error.statusCode = 404;
    throw error;
  }
  return vehicle;
}

module.exports = { listPublicVehicles, getPublicVehicle };
