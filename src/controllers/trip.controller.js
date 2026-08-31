const tripService = require("../services/trip.service");

async function createTrip(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const trip = await tripService.createTrip(tenantId, req.body);
    res.status(201).json({ message: "Trip created successfully", trip });
  } catch (error) {
    next(error);
  }
}

async function startTrip(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const trip = await tripService.startTrip(tenantId, req.params.id, req.body);
    res.json({ message: "Trip started successfully", trip });
  } catch (error) {
    next(error);
  }
}

async function endTrip(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const trip = await tripService.endTrip(tenantId, req.params.id, req.body);
    res.json({ message: "Trip completed successfully", trip });
  } catch (error) {
    next(error);
  }
}

async function listTrips(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const trips = await tripService.listTrips(tenantId, req.query);
    res.json({ trips });
  } catch (error) {
    next(error);
  }
}

async function getActiveTrips(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const trips = await tripService.listTrips(tenantId, { ...req.query, status: "ONGOING" });
    res.json({ activeTrips: trips });
  } catch (error) {
    next(error);
  }
}

async function getTripById(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const trip = await tripService.getTripById(tenantId, req.params.id);
    res.json({ trip });
  } catch (error) {
    next(error);
  }
}

async function updateRoute(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const trip = await tripService.updateRoute(tenantId, req.params.id, req.body.routeData);
    res.json({ message: "Trip route updated successfully", trip });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTrip,
  startTrip,
  endTrip,
  listTrips,
  getActiveTrips,
  getTripById,
  updateRoute,
};
