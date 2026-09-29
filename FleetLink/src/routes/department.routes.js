const express = require("express");

const router = express.Router();

const departmentController = require("../controllers/department.controller");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");

// A department always belongs to the caller's tenant. Never accept a tenant
// identifier supplied by the browser for this tenant-scoped operation.
router.post("/", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), departmentController.createDepartment);

module.exports = router;
