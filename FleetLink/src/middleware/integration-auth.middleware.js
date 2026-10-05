const { authenticateApiKey } = require("../services/integration.service");

function integrationAuth(requiredScope) {
  return async (req, res, next) => {
    const authorization = req.get("authorization") || "";
    if (!authorization.startsWith("Bearer flk_")) return res.status(401).json({ message: "Integration API key required" });
    try {
      const integration = await authenticateApiKey(authorization.slice(7), requiredScope);
      if (!integration) return res.status(401).json({ message: "Invalid or revoked integration API key" });
      req.integration = integration;
      next();
    } catch (error) { next(error); }
  };
}

module.exports = integrationAuth;
