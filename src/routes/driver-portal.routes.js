const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const authMiddleware = require("../middleware/auth.middleware");

router.use(authMiddleware);

// GET /api/driver-portal/my-trips
router.get("/my-trips", async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    // Find driver associated with this user
    const driver = await prisma.driver.findFirst({
      where: { tenantId, userId },
    });

    const trips = await prisma.trip.findMany({
      where: {
        tenantId,
        ...(driver ? { driverId: driver.id } : { booking: { requestedById: userId } }),
      },
      include: {
        vehicle: { select: { id: true, registration: true, make: true, model: true, status: true } },
        booking: { select: { id: true, justification: true, startAt: true, endAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ driver, trips });
  } catch (error) {
    next(error);
  }
});

// GET /api/driver-portal/my-vehicle
router.get("/my-vehicle", async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const driver = await prisma.driver.findFirst({
      where: { tenantId, userId },
    });

    const activeTrip = await prisma.trip.findFirst({
      where: {
        tenantId,
        status: "ONGOING",
        ...(driver ? { driverId: driver.id } : { booking: { requestedById: userId } }),
      },
      include: { vehicle: true },
    });

    res.json({
      driver,
      assignedVehicle: activeTrip?.vehicle || null,
      activeTrip: activeTrip || null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
