const express = require("express");

const router = express.Router();

const tenantController = require("../controllers/tenant.controller");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");

router.use(authMiddleware);
router.get("/me/custom-fields", tenantController.getTenantCustomFields);
router.route("/me/config").get(requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), tenantController.getTenantConfig).patch(requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), tenantController.updateTenantConfig);
router.route("/").get(requireRole(["SUPER_ADMIN"]), tenantController.listTenants).post(requireRole(["SUPER_ADMIN"]), tenantController.createTenant);
router.route("/:tenantId").patch(requireRole(["SUPER_ADMIN"]), tenantController.updateTenant).delete(requireRole(["SUPER_ADMIN"]), tenantController.deleteTenant);

module.exports = router;
