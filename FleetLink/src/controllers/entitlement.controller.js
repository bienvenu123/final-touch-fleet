const { loadTenantEntitlements, updateTenantPackage } = require("../services/entitlement.service");

async function getTenantEntitlements(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const entitlement = await loadTenantEntitlements(tenantId);
    if (!entitlement) return res.status(404).json({ message: "Tenant not found" });
    res.json({ entitlement });
  } catch (error) {
    next(error);
  }
}

async function upgradeTenantPackage(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const packageName = req.body.package;
    const featureOverrides = req.body.featureOverrides;
    if (!packageName) {
      return res.status(400).json({ message: "Package is required" });
    }

    const entitlement = await updateTenantPackage(tenantId, { package: packageName, featureOverrides });
    res.json({ message: "Tenant package updated", entitlement });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTenantEntitlements,
  upgradeTenantPackage,
};
