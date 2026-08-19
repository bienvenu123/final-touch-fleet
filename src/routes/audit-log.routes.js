const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const { getAuditLogs } = require("../controllers/audit-log.controller");

const router = express.Router();
router.get("/", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), getAuditLogs);

module.exports = router;
