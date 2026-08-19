const prisma = require("../config/prisma");
const { validationError } = require("../utils/rental-validation");

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
      driverLicense,
      contact,
    },
  });
}

async function getCustomer(tenantId, customerId) {
  return prisma.customer.findFirst({
    where: { id: customerId, tenantId },
  });
}

module.exports = {
  createCustomer,
  getCustomer,
};
