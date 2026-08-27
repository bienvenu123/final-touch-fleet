const express = require("express");
const controller = require("../controllers/public-fleet.controller");
const router = express.Router();

router.get("/vehicles", controller.listVehicles);
router.get("/vehicles/:vehicleId", controller.getVehicle);

module.exports = router;
