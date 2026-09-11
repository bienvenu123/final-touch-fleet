const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const {
  submitBooking,
  listBookings,
  approveBooking,
  rejectBooking,
  updateBooking,
  deleteBooking,
} = require("../controllers/booking.controller");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  requireRole(["STAFF", "DEPARTMENT_HEAD", "FLEET_MANAGER", "SUPER_ADMIN"]),
  listBookings
);

router.post(
  "/",
  authMiddleware,
  requireRole(["STAFF", "FLEET_MANAGER", "SUPER_ADMIN"]),
  submitBooking
);

router.patch(
  "/:bookingId",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  updateBooking
);

router.delete(
  "/:bookingId",
  authMiddleware,
  requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]),
  deleteBooking
);

router.post(
  "/:bookingId/approval",
  authMiddleware,
  requireRole(["DEPARTMENT_HEAD", "FLEET_MANAGER", "SUPER_ADMIN"]),
  approveBooking
);

router.post(
  "/:bookingId/rejection",
  authMiddleware,
  requireRole(["DEPARTMENT_HEAD", "FLEET_MANAGER", "SUPER_ADMIN"]),
  rejectBooking
);

module.exports = router;
