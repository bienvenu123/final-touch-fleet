const prisma = require("../config/prisma");

const statuses = new Set(["NEW", "IN_PROGRESS", "RESOLVED"]);

async function listContactMessages(tenantId, query = {}) {
  const status = typeof query.status === "string" ? query.status.trim().toUpperCase() : "";
  if (status && !statuses.has(status)) {
    const error = new Error("Invalid contact message status");
    error.statusCode = 400;
    throw error;
  }

  return prisma.contactMessage.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(Number(query.limit) || 100, 1), 200),
  });
}

async function updateContactMessageStatus(tenantId, id, status) {
  const normalizedStatus = typeof status === "string" ? status.trim().toUpperCase() : "";
  if (!statuses.has(normalizedStatus)) {
    const error = new Error("Status must be NEW, IN_PROGRESS, or RESOLVED");
    error.statusCode = 400;
    throw error;
  }

  const result = await prisma.contactMessage.updateMany({
    where: { id, tenantId },
    data: { status: normalizedStatus },
  });
  if (!result.count) {
    const error = new Error("Contact message not found");
    error.statusCode = 404;
    throw error;
  }
  return prisma.contactMessage.findFirst({ where: { id, tenantId } });
}

module.exports = { listContactMessages, updateContactMessageStatus };
