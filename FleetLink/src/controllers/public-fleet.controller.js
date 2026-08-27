const publicFleet = require("../services/public-fleet.service");

async function listVehicles(req, res, next) {
  try { res.json({ vehicles: await publicFleet.listPublicVehicles(req.query) }); }
  catch (error) { next(error); }
}

async function getVehicle(req, res, next) {
  try { res.json({ vehicle: await publicFleet.getPublicVehicle(req.params.vehicleId) }); }
  catch (error) { next(error); }
}

module.exports = { listVehicles, getVehicle };
