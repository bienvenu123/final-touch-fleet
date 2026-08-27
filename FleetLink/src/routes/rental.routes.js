const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const rentalReservationController = require("../controllers/rentalReservation.controller");

const router = express.Router();

router.get("/", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), rentalReservationController.listRentalReservations);

router.post("/", authMiddleware, rentalReservationController.createRentalReservation);
router.post("/:reservationId/extend", authMiddleware, rentalReservationController.requestRentalExtension);

module.exports = router;
