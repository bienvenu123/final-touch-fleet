const prisma = require("../config/prisma");
const { validationError } = require("../utils/rental-validation");
const { encryptText, decryptText, stableHash } = require("../utils/crypto");

function serializeCustomer(customer) {
  return customer ? { ...customer, driverLicense: decryptText(customer.driverLicense), driverLicenseHash: undefined } : customer;
}

async function createCustomer(tenantId, data) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const driverLicense = typeof data.driverLicense === "string" ? data.driverLicense.trim() : "";
  const contact = typeof data.contact === "string" ? data.contact.trim() : null;

  if (!tenantId) {
    throw validationError("tenantId is required");
  }
  if (!name) {
    throw validationError("name is required");
  }
  if (!email) {
    throw validationError("email is required");
  }
  if (!driverLicense) {
    throw validationError("driverLicense is required");
  }

  const existing = await prisma.customer.findFirst({
    where: { tenantId, email },
  });
  if (existing) {
    throw validationError("A customer with this email already exists");
  }

  return prisma.customer.create({
    data: {
      tenantId,
      name,
      email,
      driverLicense: encryptText(driverLicense),
      driverLicenseHash: stableHash(driverLicense),
      contact,
    },
  }).then(serializeCustomer);
}

async function getCustomer(tenantId, customerId) {
  return prisma.customer.findFirst({
    where: { id: customerId, tenantId },
  });
}

async function listCustomers(tenantId, options = {}) {
  const limit = Number(options.limit ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw validationError("limit must be a whole number between 1 and 500");
  const search = typeof options.search === "string" ? options.search.trim() : "";
  const customers = await prisma.customer.findMany({
    where: {
      tenantId,
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}),
    },
    include: { _count: { select: { reservations: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const needle = search.toLowerCase();
  return customers.map(serializeCustomer).filter((customer) => !needle || customer.name.toLowerCase().includes(needle) || customer.email.toLowerCase().includes(needle) || customer.driverLicense.toLowerCase().includes(needle));
}

async function updateCustomer(tenantId, customerId, data) {
  const customer = await getCustomer(tenantId, customerId);
  if (!customer) throw validationError("Customer not found");
  const updates = {};
  if (data.name !== undefined) {
    const name = String(data.name).trim();
    if (!name) throw validationError("name is required");
    updates.name = name;
  }
  if (data.email !== undefined) {
    const email = String(data.email).trim().toLowerCase();
    if (!email) throw validationError("email is required");
    const existing = await prisma.customer.findFirst({ where: { tenantId, email, id: { not: customerId } } });
    if (existing) throw validationError("A customer with this email already exists");
    updates.email = email;
  }
  if (data.driverLicense !== undefined) {
    const driverLicense = String(data.driverLicense).trim();
    if (!driverLicense) throw validationError("driverLicense is required");
    updates.driverLicense = encryptText(driverLicense);
    updates.driverLicenseHash = stableHash(driverLicense);
  }
  if (data.contact !== undefined) updates.contact = data.contact ? String(data.contact).trim() : null;
  return prisma.customer.update({ where: { id: customerId }, data: updates }).then(serializeCustomer);
}

async function deleteCustomer(tenantId, customerId) {
  const customer = await getCustomer(tenantId, customerId);
  if (!customer) throw validationError("Customer not found");
  const reservations = await prisma.rentalReservation.count({ where: { customerId } });
  if (reservations) throw validationError("Customer with rental history cannot be deleted");
  return prisma.customer.delete({ where: { id: customerId } });
}

module.exports = {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
  deleteCustomer,
};
