const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const rentalReservationController = require("../controllers/rentalReservation.controller");

const router = express.Router();

router.use(authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]));

router.get("/", rentalReservationController.listRentalReservations);
router.post("/", rentalReservationController.createRentalReservation);
router.post("/:reservationId/extend", rentalReservationController.requestRentalExtension);

module.exports = router;
