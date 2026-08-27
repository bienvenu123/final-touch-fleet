const prisma = require("../config/prisma");
const { compactMetadata } = require("../utils/audit-log-metadata");

async function writeAuditLog(entry) {
  return prisma.auditLog.create({ data: { ...entry, metadata: compactMetadata(entry.metadata) } });
}

function parseOptionalDate(value, field) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${field} must be a valid date`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

async function listAuditLogs(tenantId, filters = {}) {
  const from = parseOptionalDate(filters.from, "from");
  const to = parseOptionalDate(filters.to, "to");
  const take = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
  const category = filters.category === "SECURITY" || filters.category === "AUDIT" ? filters.category : undefined;

  return prisma.auditLog.findMany({
    where: {
      tenantId,
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(category ? { category } : {}),
      ...(from || to ? { occurredAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take,
  });
}

module.exports = { writeAuditLog, listAuditLogs, compactMetadata };
