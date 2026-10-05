const driverService = require("../services/driver.service");

async function createDriver(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const driver = await driverService.createDriver(tenantId, req.body);
    res.status(201).json({ message: "Driver created successfully", driver });
  } catch (error) {
    next(error);
  }
}

async function listDrivers(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const drivers = await driverService.listDrivers(tenantId, req.query);
    res.json({ drivers });
  } catch (error) {
    next(error);
  }
}

async function listAssignableDrivers(req, res, next) {
  try { res.json({ drivers: await driverService.listAssignableDrivers(req.user.tenantId) }); }
  catch (error) { next(error); }
}

async function getDriverById(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const driver = await driverService.getDriverById(tenantId, req.params.id);
    res.json({ driver });
  } catch (error) {
    next(error);
  }
}

async function updateDriver(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const driver = await driverService.updateDriver(tenantId, req.params.id, req.body);
    res.json({ message: "Driver updated successfully", driver });
  } catch (error) {
    next(error);
  }
}

async function deleteDriver(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    await driverService.deleteDriver(tenantId, req.params.id);
    res.json({ message: "Driver deleted successfully" });
  } catch (error) {
    next(error);
  }
}

async function getDriverHistory(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const history = await driverService.getDriverTripHistory(tenantId, req.params.id);
    res.json({ history });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createDriver,
  listDrivers,
  listAssignableDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
  getDriverHistory,
};
