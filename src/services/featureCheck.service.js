const { hasFeature } = require("./entitlement.service");

function assertFeatureAllowed(entitlement, feature) {
  if (!hasFeature(entitlement, feature)) {
    const error = new Error(`Feature ${feature} is not available for this tenant package`);
    error.statusCode = 403;
    throw error;
  }
  return true;
}

module.exports = { assertFeatureAllowed };
