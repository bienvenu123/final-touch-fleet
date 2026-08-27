const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const entitlementMiddleware = require("../middleware/entitlement.middleware");
const analyticsController = require("../controllers/analytics.controller");

const router = express.Router();

router.get(
  "/vehicle-utilization",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  entitlementMiddleware("advancedAnalytics"),
  analyticsController.getVehicleUtilization
);

router.get(
  "/department-roi",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  entitlementMiddleware("advancedAnalytics"),
  analyticsController.getDepartmentRoi
);

router.get(
  "/top-requesters",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  entitlementMiddleware("advancedAnalytics"),
  analyticsController.getTopRequesters
);

router.get(
  "/fuel-efficiency",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  analyticsController.getFuelEnergyEfficiency
);

router.get(
  "/maintenance-compliance",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  analyticsController.getMaintenanceCompliance
);

module.exports = router;
