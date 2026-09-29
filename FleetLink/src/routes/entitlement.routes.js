const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const entitlementController = require("../controllers/entitlement.controller");

const router = express.Router();

router.get("/", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), entitlementController.getTenantEntitlements);
router.patch("/package", authMiddleware, requireRole(["SUPER_ADMIN"]), entitlementController.upgradeTenantPackage);

module.exports = router;
