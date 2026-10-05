const tenantService = require("../services/tenant.service");

const createTenant = async (req, res, next) => {

    try {

        const tenant = await tenantService.createTenant(req.body);

        res.status(201).json({
            message: "Tenant created successfully",
            tenant
        });

    } catch (error) {

        next(error);

    }

};

const listTenants = async (_req, res, next) => { try { res.json({ tenants: await tenantService.listTenants() }); } catch (error) { next(error); } };
const updateTenant = async (req, res, next) => { try { res.json({ tenant: await tenantService.updateTenant(req.params.tenantId, req.body) }); } catch (error) { next(error); } };
const deleteTenant = async (req, res, next) => { try { res.json({ tenant: await tenantService.deleteTenant(req.params.tenantId) }); } catch (error) { next(error); } };

async function getTenantConfig(req, res, next) {
  try {
    res.json({ config: await tenantService.getTenantConfig(req.user.tenantId) });
  } catch (error) {
    next(error);
  }
}

async function updateTenantConfig(req, res, next) {
  try {
    const config = await tenantService.updateTenantConfig(req.user.tenantId, req.body);
    res.json({ message: "Tenant configuration updated successfully", config });
  } catch (error) {
    next(error);
  }
}

async function getTenantCustomFields(req, res, next) {
  try { res.json({ customFields: await tenantService.getTenantCustomFields(req.user.tenantId, req.query.entity) }); }
  catch (error) { next(error); }
}

module.exports = { createTenant, listTenants, updateTenant, deleteTenant, getTenantConfig, getTenantCustomFields, updateTenantConfig };
