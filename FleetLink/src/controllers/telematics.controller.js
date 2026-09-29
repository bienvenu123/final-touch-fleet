const telematics = require("../services/telematics.service");
const prisma = require("../config/prisma");

async function ingestLocation(req, res, next) {
  try {
    if (req.user.role === "DRIVER") {
      const driver = await prisma.driver.findFirst({ where: { tenantId: req.user.tenantId, userId: req.user.userId }, select: { id: true } });
      const assignedTrip = driver && await prisma.trip.findFirst({ where: { tenantId: req.user.tenantId, driverId: driver.id, vehicleId: req.body.vehicleId, status: "ONGOING" }, select: { id: true } });
      if (!assignedTrip) return res.status(403).json({ message: "Drivers may submit locations only for their active assigned trip" });
    }
    res.status(201).json({ location: await telematics.ingestLocation(req.user.tenantId, req.body) });
  } catch (error) { next(error); }
}
async function listLocations(req, res, next) { try { res.json({ locations: await telematics.listLocations(req.user.tenantId, req.params.vehicleId, req.query) }); } catch (error) { next(error); } }
async function getLatestLocation(req, res, next) { try { const location = await telematics.getLatestLocation(req.user.tenantId, req.params.vehicleId); if (!location) return res.status(404).json({ message: "No location recorded" }); res.json({ location }); } catch (error) { next(error); } }

module.exports = { ingestLocation, listLocations, getLatestLocation };
