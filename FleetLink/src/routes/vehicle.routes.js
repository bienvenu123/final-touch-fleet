const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const { getAvailableVehicles, listVehicles, createVehicle, updateVehicleStatus } = require("../controllers/vehicle.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listVehicles);
router.post("/", requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), createVehicle);
router.get("/available", requireRole(["STAFF", "FLEET_MANAGER", "SUPER_ADMIN"]), getAvailableVehicles);
router.patch("/:id/status", requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), updateVehicleStatus);

module.exports = router;
