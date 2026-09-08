const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const authMiddleware = require("../middleware/auth.middleware");
const tripService = require("../services/trip.service");

router.use(authMiddleware);

// GET /api/driver-portal/my-trips
router.get("/my-trips", async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId ?? req.user.id;

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
    const userId = req.user.userId ?? req.user.id;

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

async function ensureDriverTrip(req) {
  const userId = req.user.userId ?? req.user.id;
  const driver = await prisma.driver.findFirst({ where: { tenantId: req.user.tenantId, userId }, select: { id: true } });
  const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, tenantId: req.user.tenantId, ...(driver ? { driverId: driver.id } : { booking: { requestedById: userId } }) }, select: { id: true } });
  if (!trip) { const error = new Error("Trip not found"); error.statusCode = 404; throw error; }
  return trip;
}

router.post("/my-trips/:tripId/start", async (req, res, next) => { try { const trip = await ensureDriverTrip(req); res.json({ trip: await tripService.startTrip(req.user.tenantId, trip.id, req.body) }); } catch (error) { next(error); } });
router.post("/my-trips/:tripId/end", async (req, res, next) => { try { const trip = await ensureDriverTrip(req); res.json({ trip: await tripService.endTrip(req.user.tenantId, trip.id, req.body) }); } catch (error) { next(error); } });

module.exports = router;
