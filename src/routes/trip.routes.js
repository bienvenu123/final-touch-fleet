const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const tripController = require("../controllers/trip.controller");

router.use(authMiddleware);

router.post("/", tripController.createTrip);
router.get("/", tripController.listTrips);
router.get("/active", tripController.getActiveTrips);
router.get("/:id", tripController.getTripById);
router.post("/:id/start", tripController.startTrip);
router.post("/:id/end", tripController.endTrip);
router.patch("/:id/route", tripController.updateRoute);

module.exports = router;
