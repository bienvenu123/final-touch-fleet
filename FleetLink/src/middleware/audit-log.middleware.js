const { writeAuditLog } = require("../services/audit-log.service");
const { shouldAudit, buildAuditEntry } = require("../utils/audit-log.helpers");

function auditLogMiddleware(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    if (!shouldAudit(req, res.statusCode)) return;

    const entry = buildAuditEntry(req, res, startedAt);
    void writeAuditLog(entry).catch((error) =>
      console.error("Unable to write audit log", error.message)
    );
  });

  next();
}

module.exports = auditLogMiddleware;
