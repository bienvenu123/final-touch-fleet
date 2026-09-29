const express = require("express");
const auth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");
const billing = require("../services/billing.service");
const router = express.Router();
router.use(auth);
router.get("/vehicle-usage", requireRole(["FLEET_MANAGER", "SUPER_ADMIN"]), async (req, res, next) => { try { res.json({ billing: await billing.getVehicleBilling(req.user.tenantId) }); } catch (error) { next(error); } });
router.patch("/vehicle-usage", requireRole(["SUPER_ADMIN"]), async (req, res, next) => { try { res.json({ billing: await billing.updateVehicleBilling(req.user.tenantId, req.body) }); } catch (error) { next(error); } });
module.exports = router;
