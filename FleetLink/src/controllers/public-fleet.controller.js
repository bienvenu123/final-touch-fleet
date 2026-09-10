const publicFleet = require("../services/public-fleet.service");

async function listVehicles(req, res, next) {
  try { res.json({ vehicles: await publicFleet.listPublicVehicles(req.query) }); }
  catch (error) { next(error); }
}

async function getVehicle(req, res, next) {
  try { res.json({ vehicle: await publicFleet.getPublicVehicle(req.params.vehicleId) }); }
  catch (error) { next(error); }
}

async function submitBooking(req, res, next) {
  try { res.status(201).json({ booking: await publicFleet.submitPublicBooking(req.body) }); }
  catch (error) { next(error); }
}

async function submitContactMessage(req, res, next) {
  try { res.status(201).json({ message: await publicFleet.submitContactMessage(req.body) }); }
  catch (error) { next(error); }
}

module.exports = { listVehicles, getVehicle, submitBooking, submitContactMessage };
