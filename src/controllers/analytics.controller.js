const analyticsService = require("../services/analytics.service");
const efficiencyService = require("../services/efficiency.service");

async function getVehicleUtilization(req, res, next) {
  try {
    const metrics = await analyticsService.getVehicleUtilization(req.user.tenantId, req.query);
    res.json({ metrics });
  } catch (error) {
    next(error);
  }
}

async function getDepartmentRoi(req, res, next) {
  try {
    const metrics = await analyticsService.getDepartmentRoi(req.user.tenantId, req.query);
    res.json({ metrics });
  } catch (error) {
    next(error);
  }
}

async function getTopRequesters(req, res, next) {
  try {
    const metrics = await analyticsService.getTopRequesters(req.user.tenantId, req.query);
    res.json({ metrics });
  } catch (error) {
    next(error);
  }
}

async function getFuelEnergyEfficiency(req, res, next) {
  try {
    const report = await efficiencyService.getFuelEnergyEfficiency(req.user.tenantId, req.query);
    res.json({ report });
  } catch (error) {
    next(error);
  }
}

async function getMaintenanceCompliance(req, res, next) {
  try {
    const report = await efficiencyService.getMaintenanceCompliance(req.user.tenantId, req.query);
    res.json({ report });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getVehicleUtilization,
  getDepartmentRoi,
  getTopRequesters,
  getFuelEnergyEfficiency,
  getMaintenanceCompliance,
};
