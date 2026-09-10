const express = require("express");
const auth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const controller = require("../controllers/contact-message.controller");

const router = express.Router();
router.use(auth, requireRole(["FLEET_MANAGER"]));
router.get("/", controller.listContactMessages);
router.patch("/:id", controller.updateContactMessageStatus);

module.exports = router;
