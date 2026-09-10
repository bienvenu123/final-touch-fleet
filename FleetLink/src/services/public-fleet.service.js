const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const { randomUUID } = require("crypto");
const { createBooking } = require("./booking.service");

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

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function getOrCreateGuestRequester(tenantId, data) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const contact = typeof data.contact === "string" ? data.contact.trim() : "";

  if (!name) throw validationError("name is required");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw validationError("a valid email is required");
  if (!contact) throw validationError("contact number is required");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.tenantId !== tenantId) throw validationError("This email cannot be used for the public booking service");
    return existing;
  }

  return prisma.user.create({
    data: {
      tenantId,
      name,
      email,
      contact,
      role: "CUSTOMER",
      password: await bcrypt.hash(randomUUID(), 10),
    },
  });
}

async function submitPublicBooking(data = {}) {
  const tenantId = publicTenantId();
  const requester = await getOrCreateGuestRequester(tenantId, data);
  const purpose = typeof data.purpose === "string" && data.purpose.trim()
    ? data.purpose.trim()
    : "Public website booking request";

  const booking = await createBooking(tenantId, requester.id, {
    vehicleId: data.vehicleId,
    start: data.start,
    end: data.end,
    passengerCount: data.passengerCount,
    destination: data.destination,
    justification: purpose,
    kind: "CORPORATE",
  });

  return booking;
}

async function submitContactMessage(data = {}) {
  const tenantId = publicTenantId();
  const firstName = typeof data.firstName === "string" ? data.firstName.trim() : "";
  const lastName = typeof data.lastName === "string" ? data.lastName.trim() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";

  if (!firstName) throw validationError("first name is required");
  if (!phone) throw validationError("phone number is required");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw validationError("a valid email is required");
  if (!message) throw validationError("message is required");

  return prisma.contactMessage.create({
    data: { tenantId, firstName, lastName: lastName || null, phone, email, message },
  });
}

module.exports = { listPublicVehicles, getPublicVehicle, submitPublicBooking, submitContactMessage };
