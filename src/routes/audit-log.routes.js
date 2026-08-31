const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const { getAuditLogs, exportAuditLogs } = require("../controllers/audit-log.controller");

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]));

router.get("/", getAuditLogs);
router.get("/export", exportAuditLogs);

module.exports = router;
