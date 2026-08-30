const { listAuditLogs, generateAuditLogsCSV, generateAuditLogsPDF } = require("../services/audit-log.service");

async function getAuditLogs(req, res, next) {
  try {
    res.json({ auditLogs: await listAuditLogs(req.user.tenantId, req.query) });
  } catch (error) {
    next(error);
  }
}

async function exportAuditLogs(req, res, next) {
  try {
    const format = (req.query.format || "csv").toLowerCase();
    const logs = await listAuditLogs(req.user.tenantId, req.query);

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=audit-logs-${Date.now()}.pdf`);
      generateAuditLogsPDF(logs, res);
      return;
    }

    const csvData = generateAuditLogsCSV(logs);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=audit-logs-${Date.now()}.csv`);
    res.send(csvData);
  } catch (error) {
    next(error);
  }
}

module.exports = { getAuditLogs, exportAuditLogs };
