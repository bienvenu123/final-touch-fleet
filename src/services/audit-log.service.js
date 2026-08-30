const prisma = require("../config/prisma");
const PDFDocument = require("pdfkit");
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

function generateAuditLogsCSV(logs) {
  const headers = ["ID", "Occurred At", "Category", "Action", "Actor Email", "Method", "Route", "Status Code"];
  const rows = logs.map((log) => [
    log.id,
    new Date(log.occurredAt).toISOString(),
    log.category,
    `"${(log.action || "").replace(/"/g, '""')}"`,
    log.actorEmail || "",
    log.method || "",
    log.route || "",
    log.statusCode || "",
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function generateAuditLogsPDF(logs, stream) {
  const doc = new PDFDocument({ margin: 30, size: "A4" });
  doc.pipe(stream);

  doc.fontSize(18).text("FleetLink — Audit Log Report", { align: "center" });
  doc.fontSize(10).text(`Generated at: ${new Date().toISOString()}`, { align: "center" });
  doc.moveDown();

  logs.slice(0, 100).forEach((log, index) => {
    doc.fontSize(9).text(`${index + 1}. [${new Date(log.occurredAt).toISOString()}] ${log.category} - ${log.action}`);
    doc.fontSize(8).fillColor("gray").text(`   Actor: ${log.actorEmail || "System"} | Method: ${log.method} ${log.route} | Status: ${log.statusCode}`);
    doc.fillColor("black");
    doc.moveDown(0.3);
  });

  doc.end();
}

module.exports = { writeAuditLog, listAuditLogs, generateAuditLogsCSV, generateAuditLogsPDF, compactMetadata };
