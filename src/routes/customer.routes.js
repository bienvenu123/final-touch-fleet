const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const customerController = require("../controllers/customer.controller");

const router = express.Router();

router.post("/", authMiddleware, customerController.createCustomer);

module.exports = router;
