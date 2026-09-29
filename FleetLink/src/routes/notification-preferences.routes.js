const express = require("express");
const auth = require("../middleware/auth.middleware");
const controller = require("../controllers/notification-preferences.controller");

const router = express.Router();
router.use(auth);
router.route("/preferences").get(controller.getPreferences).put(controller.updatePreferences);
router.post("/devices", controller.registerPushToken);
router.delete("/devices/:token", controller.revokePushToken);
module.exports = router;
