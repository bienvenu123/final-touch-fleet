const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const maintenanceController = require("../controllers/maintenance.controller");

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  (req, res) => {
    res.json({
      message: "Fleet Manager dashboard data",
      tenantId: req.user.tenantId,
    });
  }
);

router.post("/vehicles", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), maintenanceController.createVehicle);
router.patch("/vehicles/:vehicleId/odometer", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), maintenanceController.updateOdometer);
router.post("/vehicles/:vehicleId/service-records", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), maintenanceController.logServiceRecord);
router.get("/vehicles/:vehicleId/service-records", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), maintenanceController.listServiceHistory);
router.get("/maintenance/approaching", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), maintenanceController.approachingMaintenance);

module.exports = router;
