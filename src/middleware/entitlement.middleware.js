const { loadTenantEntitlements, hasFeature, buildUpgradePrompt } = require("../services/entitlement.service");

function entitlementMiddleware(feature) {
  return async (req, res, next) => {
    if (!req.user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const entitlement = await loadTenantEntitlements(req.user.tenantId);
      if (!entitlement) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      req.entitlement = entitlement;

      if (!hasFeature(entitlement, feature)) {
        return res.status(403).json({
          message: "Feature unavailable for your current subscription package.",
          upgrade: buildUpgradePrompt(feature, entitlement.package),
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = entitlementMiddleware;
