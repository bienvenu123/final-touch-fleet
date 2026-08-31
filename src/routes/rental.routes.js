const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const rentalReservationController = require("../controllers/rentalReservation.controller");

const router = express.Router();

router.post("/", authMiddleware, rentalReservationController.createRentalReservation);
router.post("/:reservationId/extend", authMiddleware, rentalReservationController.requestRentalExtension);

module.exports = router;
