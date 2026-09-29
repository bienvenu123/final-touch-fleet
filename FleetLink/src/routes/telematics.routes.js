const express = require("express");
const auth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const entitlement = require("../middleware/entitlement.middleware");
const controller = require("../controllers/telematics.controller");

const router = express.Router();
router.use(auth, requireRole(["FLEET_MANAGER", "SUPER_ADMIN", "DRIVER"]), entitlement("gpsTelematics"));
router.post("/locations", controller.ingestLocation);
router.get("/vehicles/:vehicleId/locations", requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), controller.listLocations);
router.get("/vehicles/:vehicleId/location", requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), controller.getLatestLocation);
module.exports = router;
