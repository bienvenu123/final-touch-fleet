const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const entitlementController = require("../controllers/entitlement.controller");

const router = express.Router();

router.get("/:tenantId?", authMiddleware, requireRole(["SUPER_ADMIN"]), entitlementController.getTenantEntitlements);
router.patch("/:tenantId/package", authMiddleware, requireRole(["SUPER_ADMIN"]), entitlementController.upgradeTenantPackage);

module.exports = router;
