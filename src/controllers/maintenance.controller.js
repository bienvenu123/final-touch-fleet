const maintenanceService = require("../services/maintenance.service");

const createVehicle = async (req, res, next) => {
  try {
    // If a file was uploaded, attach its Cloudinary URL to the body
    const body = { ...req.body, imageUrl: req.file ? req.file.path : req.body.imageUrl };
    res.status(201).json({ vehicle: await maintenanceService.createVehicle(req.user.tenantId, body) });
  } catch (error) { next(error); }
};

const updateOdometer = async (req, res, next) => {
  try { res.json(await maintenanceService.updateOdometer(req.user.tenantId, req.params.vehicleId, req.body.odometerCurrent)); }
  catch (error) { next(error); }
};

const updateVehicleImage = async (req, res, next) => {
  try { res.json({ vehicle: await maintenanceService.updateVehicleImage(req.user.tenantId, req.params.vehicleId, req.body.imageUrl) }); }
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

module.exports = { createVehicle, updateOdometer, updateVehicleImage, logServiceRecord, listServiceHistory, approachingMaintenance };
