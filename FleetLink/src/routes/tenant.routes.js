const express = require("express");

const router = express.Router();

const tenantController = require("../controllers/tenant.controller");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");

router.use(authMiddleware, requireRole(["SUPER_ADMIN"]));
router.route("/").get(tenantController.listTenants).post(tenantController.createTenant);
router.route("/:tenantId").patch(tenantController.updateTenant).delete(tenantController.deleteTenant);

module.exports = router;
