const express = require("express");
const newsletterService = require("../services/newsletter.service");
const auth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/requireRole.middleware");

const router = express.Router();

router.post("/subscribe", async (req, res, next) => {
  try {
    const result = await newsletterService.subscribe(req.body?.email, req.body?.consent);
    res.status(201).json({ ...result, message: "You’re subscribed to FleetLink email updates." });
  } catch (error) {
    next(error);
  }
});

router.get("/unsubscribe/:token", async (req, res, next) => {
  try {
    await newsletterService.unsubscribe(req.params.token);
    res.type("html").send("<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Unsubscribed</title></head><body style=\"font:16px Arial,sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#10233f\"><h1>You’re unsubscribed</h1><p>You will no longer receive FleetLink newsletter emails. You can subscribe again from the FleetLink website.</p></body></html>");
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).type("html").send("<!doctype html><html><body style=\"font:16px Arial,sans-serif;margin:12vh auto;max-width:560px;padding:24px\"><h1>Link not found</h1><p>This unsubscribe link is invalid or has expired.</p></body></html>");
    next(error);
  }
});

router.post("/unsubscribe/:token", async (req, res, next) => {
  try {
    await newsletterService.unsubscribe(req.params.token);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/audience", auth, requireRole(["FLEET_MANAGER"]), async (req, res, next) => {
  try {
    res.json(await newsletterService.getAudience(req.user.tenantId));
  } catch (error) {
    next(error);
  }
});

router.post("/campaign", auth, requireRole(["FLEET_MANAGER"]), async (req, res, next) => {
  try {
    res.json(await newsletterService.sendCampaign(req.user.tenantId, req.body));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
