const maintenanceService = require("../services/maintenance.service");

const createVehicle = async (req, res, next) => {
  try { res.status(201).json({ vehicle: await maintenanceService.createVehicle(req.user.tenantId, req.body) }); }
  catch (error) { next(error); }
};

const updateOdometer = async (req, res, next) => {
  try { res.json(await maintenanceService.updateOdometer(req.user.tenantId, req.params.vehicleId, req.body.odometerCurrent)); }
  catch (error) { next(error); }
};

const logServiceRecord = async (req, res, next) => {
  try { res.status(201).json(await maintenanceService.logServiceRecord(req.user.tenantId, req.params.vehicleId, req.body)); }
  catch (error) { next(error); }
};

const listServiceHistory = async (req, res, next) => {
  try { res.json({ serviceRecords: await maintenanceService.listServiceHistory(req.user.tenantId, req.params.vehicleId) }); }
  catch (error) { next(error); }
};

const approachingMaintenance = async (req, res, next) => {
  try { res.json({ vehicles: await maintenanceService.findVehiclesApproachingMaintenance(req.user.tenantId, req.query) }); }
  catch (error) { next(error); }
};

module.exports = { createVehicle, updateOdometer, logServiceRecord, listServiceHistory, approachingMaintenance };
