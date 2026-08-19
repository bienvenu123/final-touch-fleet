const { listAuditLogs } = require("../services/audit-log.service");

async function getAuditLogs(req, res, next) {
  try { res.json({ auditLogs: await listAuditLogs(req.user.tenantId, req.query) }); }
  catch (error) { next(error); }
}

module.exports = { getAuditLogs };
