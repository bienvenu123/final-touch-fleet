const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const authMiddleware = require("../middleware/auth.middleware");
const { getDepartmentRoi, getVehicleUtilization } = require("../services/analytics.service");

router.use(authMiddleware);

// GET /api/finance-portal/summary
router.get("/summary", async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    const [totalVehicles, activeReservations, completedTrips, serviceCosts] = await Promise.all([
      prisma.vehicle.count({ where: { tenantId, retiredAt: null } }),
      prisma.rentalReservation.count({ where: { tenantId, status: { in: ["RESERVED", "ACTIVE"] } } }),
      prisma.trip.count({ where: { tenantId, status: "COMPLETED" } }),
      prisma.serviceRecord.aggregate({
        where: { vehicle: { tenantId } },
        _sum: { cost: true },
      }),
    ]);

    res.json({
      summary: {
        totalVehicles,
        activeReservations,
        completedTrips,
        totalMaintenanceCost: Number(serviceCosts._sum.cost || 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/finance-portal/roi
router.get("/roi", async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const roiData = await getDepartmentRoi(tenantId, req.query);
    res.json({ roi: roiData });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
