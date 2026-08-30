const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const driverController = require("../controllers/driver.controller");

router.use(authMiddleware);

router.post("/", driverController.createDriver);
router.get("/", driverController.listDrivers);
router.get("/:id", driverController.getDriverById);
router.patch("/:id", driverController.updateDriver);
router.delete("/:id", driverController.deleteDriver);
router.get("/:id/history", driverController.getDriverHistory);

module.exports = router;
