const vehicleAvailabilityService = require("../services/vehicle-availability.service");

async function getAvailableVehicles(req, res, next) {
  try {
    const result = await vehicleAvailabilityService.findAvailableVehicles(req.user.tenantId, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { getAvailableVehicles };
