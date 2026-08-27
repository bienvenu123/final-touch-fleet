const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const rentalReportController = require("../controllers/rentalReport.controller");

const router = express.Router();

router.get(
  "/performance",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  rentalReportController.getRentalPerformanceReport
);

router.get(
  "/performance/export",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  rentalReportController.exportRentalPerformanceReport
);

router.post(
  "/performance/schedule",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  rentalReportController.scheduleRentalPerformanceReport
);

module.exports = router;
