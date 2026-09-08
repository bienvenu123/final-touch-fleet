const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const rentalReportController = require("../controllers/rentalReport.controller");
const entitlementMiddleware = require("../middleware/entitlement.middleware");

const router = express.Router();

router.get(
  "/performance",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  entitlementMiddleware("advancedReports"),
  rentalReportController.getRentalPerformanceReport
);

router.get(
  "/performance/export",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  entitlementMiddleware("advancedReports"),
  rentalReportController.exportRentalPerformanceReport
);

router.post(
  "/performance/schedule",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  entitlementMiddleware("scheduledExports"),
  rentalReportController.scheduleRentalPerformanceReport
);

module.exports = router;
