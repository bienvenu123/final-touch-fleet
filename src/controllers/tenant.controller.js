const tenantService = require("../services/tenant.service");

const createTenant = async (req, res, next) => {
  try {
    const tenant = await tenantService.createTenant(req.body);
    res.status(201).json({ message: "Tenant created successfully", tenant });
  } catch (error) {
    next(error);
  }
};

const getTenantConfig = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const config = await tenantService.getTenantConfig(tenantId);
    res.json({ config });
  } catch (error) {
    next(error);
  }
};

const updateTenantConfig = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const config = await tenantService.updateTenantConfig(tenantId, req.body);
    res.json({ message: "Tenant configuration updated successfully", config });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTenant,
  getTenantConfig,
  updateTenantConfig,
};