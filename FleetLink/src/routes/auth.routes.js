const express=require("express");

const router=express.Router();

const authController=require("../controllers/auth.controller");

router.post("/signup",authController.signup);

router.post("/customer-signup", authController.signupCustomer);

router.post("/login",authController.login);

module.exports=router;
