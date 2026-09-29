const preferences = require("../services/notification-preferences.service");

async function getPreferences(req, res, next) { try { res.json({ notificationPreferences: await preferences.getPreferences(req.user) }); } catch (error) { next(error); } }
async function updatePreferences(req, res, next) { try { res.json({ notificationPreferences: await preferences.updatePreferences(req.user, req.body) }); } catch (error) { next(error); } }
async function registerPushToken(req, res, next) { try { res.status(201).json({ device: await preferences.registerPushToken(req.user, req.body) }); } catch (error) { next(error); } }
async function revokePushToken(req, res, next) { try { await preferences.revokePushToken(req.user, req.params.token); res.sendStatus(204); } catch (error) { next(error); } }

module.exports = { getPreferences, updatePreferences, registerPushToken, revokePushToken };
