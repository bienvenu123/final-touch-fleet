const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const { getAvailableVehicles } = require("../controllers/vehicle.controller");

const router = express.Router();

router.get(
  "/available",
  authMiddleware,
  requireRole(["STAFF", "FLEET_MANAGER", "SUPER_ADMIN"]),
  getAvailableVehicles
);

module.exports = router;
