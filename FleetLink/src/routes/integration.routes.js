const express = require("express");
const auth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const integrationAuth = require("../middleware/integration-auth.middleware");
const controller = require("../controllers/integration.controller");

const router = express.Router();
const admin = [auth, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"])];
router.route("/keys").get(...admin, controller.listKeys).post(...admin, controller.createKey);
router.delete("/keys/:keyId", ...admin, controller.revokeKey);
router.post("/telematics/locations", integrationAuth("telematics:write"), controller.syncTelematics);
router.post("/telematics/vehicle-mappings", integrationAuth("telematics:write"), controller.mapTelematicsVehicles);
router.post("/hr/snapshot", integrationAuth("hr:write"), controller.syncHr);
router.post("/erp/cost-centres", integrationAuth("erp:write"), controller.syncErp);
router.get("/erp/department-roi", integrationAuth("erp:read"), controller.exportDepartmentRoi);
router.get("/sync-runs", integrationAuth("sync:read"), controller.listRuns);

module.exports = router;
