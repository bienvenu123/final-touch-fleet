const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const rentalInspectionController = require("../controllers/rentalInspection.controller");

const router = express.Router({ mergeParams: true });

router.post("/checkout", authMiddleware, rentalInspectionController.createRentalCheckout);
router.post("/checkin", authMiddleware, rentalInspectionController.createRentalCheckin);

module.exports = router;
