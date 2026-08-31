const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const entitlementController = require("../controllers/entitlement.controller");

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole(["SUPER_ADMIN"]));

router.get("/", entitlementController.getTenantEntitlements);
router.get("/:tenantId", entitlementController.getTenantEntitlements);
router.patch("/:tenantId/package", entitlementController.upgradeTenantPackage);

module.exports = router;
