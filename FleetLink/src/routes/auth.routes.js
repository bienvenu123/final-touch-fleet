const express=require("express");

const router=express.Router();

const authController=require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");

// Internal accounts carry operational roles and must only be provisioned by a
// platform administrator. Customer self-registration remains intentionally
// public and is constrained to the configured public tenant in the service.
router.post("/signup", authMiddleware, requireRole(["SUPER_ADMIN"]), authController.signup);

router.post("/customer-signup", authController.signupCustomer);

router.post("/login",authController.login);

module.exports=router;
