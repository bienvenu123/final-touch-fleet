const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const rentalInspectionController = require("../controllers/rentalInspection.controller");

const router = express.Router({ mergeParams: true });

router.use(authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]));
router.post("/checkout", rentalInspectionController.createRentalCheckout);
router.post("/checkin", rentalInspectionController.createRentalCheckin);

module.exports = router;
