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

router.get("/schedules", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), entitlementMiddleware("scheduledExports"), rentalReportController.listRecurringSchedules);
router.post("/schedules", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), entitlementMiddleware("scheduledExports"), rentalReportController.createRecurringSchedule);
router.put("/schedules/:scheduleId", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), entitlementMiddleware("scheduledExports"), rentalReportController.updateRecurringSchedule);
router.delete("/schedules/:scheduleId", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), entitlementMiddleware("scheduledExports"), rentalReportController.cancelRecurringSchedule);

router.get("/:reportType", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), entitlementMiddleware("advancedReports"), rentalReportController.getReport);
router.get("/:reportType/export", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), entitlementMiddleware("advancedReports"), rentalReportController.exportReport);

module.exports = router;
