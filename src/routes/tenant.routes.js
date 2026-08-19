const express = require("express");

const router = express.Router();

const tenantController = require("../controllers/tenant.controller");

router.post("/", tenantController.createTenant);

module.exports = router;