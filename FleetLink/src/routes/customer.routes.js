const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const customerController = require("../controllers/customer.controller");
const requireRole = require("../middleware/requireRole.middleware");

const router = express.Router();

router.get("/", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), customerController.listCustomers);

router.post("/", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), customerController.createCustomer);
router.patch("/:customerId", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), customerController.updateCustomer);
router.delete("/:customerId", authMiddleware, requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), customerController.deleteCustomer);

module.exports = router;
