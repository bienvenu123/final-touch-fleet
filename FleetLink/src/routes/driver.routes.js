const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const driverController = require("../controllers/driver.controller");

router.use(authMiddleware);


router.post("/", requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), driverController.createDriver);
router.get("/assignable", requireRole(["DEPARTMENT_HEAD", "FLEET_MANAGER", "SUPER_ADMIN"]), driverController.listAssignableDrivers);
router.get("/", requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), driverController.listDrivers);
router.get("/:id", requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), driverController.getDriverById);
router.patch("/:id", requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), driverController.updateDriver);
router.delete("/:id", requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), driverController.deleteDriver);
router.get("/:id/history", requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), driverController.getDriverHistory);

module.exports = router;
