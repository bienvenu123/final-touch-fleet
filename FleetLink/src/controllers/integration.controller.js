const integrations = require("../services/integration.service");
const { loadTenantEntitlements, hasFeature } = require("../services/entitlement.service");

async function createKey(req, res, next) {
  try { res.status(201).json({ integrationKey: await integrations.createApiKey(req.user.tenantId, req.body) }); }
  catch (error) { next(error); }
}
async function listKeys(req, res, next) {
  try { res.json({ integrationKeys: await integrations.listApiKeys(req.user.tenantId) }); }
  catch (error) { next(error); }
}
async function revokeKey(req, res, next) {
  try { res.json({ integrationKey: await integrations.revokeApiKey(req.user.tenantId, req.params.keyId) }); }
  catch (error) { next(error); }
}
async function syncTelematics(req, res, next) {
  try {
    const entitlement = await loadTenantEntitlements(req.integration.tenantId);
    if (!hasFeature(entitlement, "gpsTelematics")) return res.status(403).json({ message: "GPS telematics is not enabled for this tenant" });
    res.json({ sync: await integrations.syncTelematics(req.integration.tenantId, req.body) });
  } catch (error) { next(error); }
}
async function mapTelematicsVehicles(req, res, next) {
  try {
    const entitlement = await loadTenantEntitlements(req.integration.tenantId);
    if (!hasFeature(entitlement, "gpsTelematics")) return res.status(403).json({ message: "GPS telematics is not enabled for this tenant" });
    res.json({ sync: await integrations.mapTelematicsVehicles(req.integration.tenantId, req.body) });
  } catch (error) { next(error); }
}
async function syncHr(req, res, next) {
  try { res.json({ sync: await integrations.syncHrSnapshot(req.integration.tenantId, req.body) }); }
  catch (error) { next(error); }
}
async function syncErp(req, res, next) {
  try { res.json({ sync: await integrations.syncErpCostCentres(req.integration.tenantId, req.body) }); }
  catch (error) { next(error); }
}
async function exportDepartmentRoi(req, res, next) {
  try {
    const entitlement = await loadTenantEntitlements(req.integration.tenantId);
    if (!hasFeature(entitlement, "advancedAnalytics")) return res.status(403).json({ message: "Advanced analytics is not enabled for this tenant" });
    res.json({ report: await integrations.getErpDepartmentRoi(req.integration.tenantId, req.query) });
  } catch (error) { next(error); }
}
async function listRuns(req, res, next) {
  try { res.json({ syncRuns: await integrations.listSyncRuns(req.integration.tenantId, req.query.limit) }); }
  catch (error) { next(error); }
}

module.exports = { createKey, listKeys, revokeKey, syncTelematics, mapTelematicsVehicles, syncHr, syncErp, exportDepartmentRoi, listRuns };
