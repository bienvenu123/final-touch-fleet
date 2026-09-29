const prisma = require("../config/prisma");

const CHANNELS = new Set(["EMAIL", "SMS", "PUSH"]);
const expoToken = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function userIdFrom(user = {}) {
  return user.userId || user.id || user.sub;
}

function parsePreferences(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw validationError("notificationPreferences must be an object");
  const preferences = {};
  if (value.preferredChannel !== undefined) {
    const channel = String(value.preferredChannel).toUpperCase();
    if (!CHANNELS.has(channel)) throw validationError("preferredChannel must be EMAIL, SMS, or PUSH");
    preferences.preferredChannel = channel;
  }
  if (value.enabledChannels !== undefined) {
    if (!Array.isArray(value.enabledChannels)) throw validationError("enabledChannels must be an array");
    const channels = [...new Set(value.enabledChannels.map((channel) => String(channel).toUpperCase()))];
    if (!channels.length || channels.some((channel) => !CHANNELS.has(channel))) throw validationError("enabledChannels must contain EMAIL, SMS, or PUSH");
    preferences.enabledChannels = channels;
  }
  if (value.rentalReminders !== undefined) preferences.rentalReminders = Boolean(value.rentalReminders);
  if (value.bookingUpdates !== undefined) preferences.bookingUpdates = Boolean(value.bookingUpdates);
  return preferences;
}

async function getPreferences(user) {
  const record = await prisma.user.findUnique({ where: { id: userIdFrom(user) }, select: { notificationPreferences: true } });
  if (!record) throw validationError("User not found");
  return record.notificationPreferences || {};
}

async function updatePreferences(user, value) {
  const updates = parsePreferences(value);
  const existing = await getPreferences(user);
  const record = await prisma.user.update({ where: { id: userIdFrom(user) }, data: { notificationPreferences: { ...existing, ...updates } }, select: { notificationPreferences: true } });
  return record.notificationPreferences || {};
}

async function registerPushToken(user, { token, platform } = {}) {
  if (typeof token !== "string" || !expoToken.test(token)) throw validationError("token must be a valid Expo push token");
  return prisma.devicePushToken.upsert({
    where: { token },
    update: { userId: userIdFrom(user), platform: platform ? String(platform).slice(0, 32) : null, revokedAt: null },
    create: { userId: userIdFrom(user), token, platform: platform ? String(platform).slice(0, 32) : null },
    select: { id: true, token: true, platform: true, lastSeenAt: true },
  });
}

async function revokePushToken(user, token) {
  const result = await prisma.devicePushToken.updateMany({ where: { userId: userIdFrom(user), token, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!result.count) throw validationError("Push token not found");
}

module.exports = { getPreferences, updatePreferences, registerPushToken, revokePushToken };
