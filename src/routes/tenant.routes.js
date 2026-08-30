const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const tenantController = require("../controllers/tenant.controller");

router.post("/", tenantController.createTenant);

router.use(authMiddleware);
router.get("/me/config", tenantController.getTenantConfig);
router.patch("/me/config", tenantController.updateTenantConfig);

module.exports = router;