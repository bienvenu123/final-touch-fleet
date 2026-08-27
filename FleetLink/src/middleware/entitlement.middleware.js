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

      // System administrators must be able to operate and administer every
      // tenant service, irrespective of the currently selected package.
      if (req.user.role === "SUPER_ADMIN") {
        return next();
      }

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
