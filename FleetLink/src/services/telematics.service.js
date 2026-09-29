const prisma = require("../config/prisma");

function validationError(message) { const error = new Error(message); error.statusCode = 400; return error; }
function finiteNumber(value, field, { min, max, optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (min !== undefined && parsed < min) || (max !== undefined && parsed > max)) throw validationError(`${field} is invalid`);
  return parsed;
}

async function ingestLocation(tenantId, data = {}) {
  const vehicleId = String(data.vehicleId || "").trim();
  if (!vehicleId) throw validationError("vehicleId is required");
  const latitude = finiteNumber(data.latitude, "latitude", { min: -90, max: 90 });
  const longitude = finiteNumber(data.longitude, "longitude", { min: -180, max: 180 });
  const accuracyM = finiteNumber(data.accuracyM, "accuracyM", { min: 0, optional: true });
  const speedKph = finiteNumber(data.speedKph, "speedKph", { min: 0, optional: true });
  const heading = finiteNumber(data.heading, "heading", { min: 0, max: 360, optional: true });
  const odometer = finiteNumber(data.odometer, "odometer", { min: 0, optional: true });
  if (odometer !== null && !Number.isInteger(odometer)) throw validationError("odometer must be a whole number");
  const recordedAt = data.recordedAt ? new Date(data.recordedAt) : new Date();
  if (Number.isNaN(recordedAt.getTime())) throw validationError("recordedAt is invalid");
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId, retiredAt: null }, select: { id: true, odometerCurrent: true } });
  if (!vehicle) { const error = new Error("Vehicle not found"); error.statusCode = 404; throw error; }

  return prisma.$transaction(async (tx) => {
    const location = await tx.vehicleLocation.create({
      data: { tenantId, vehicleId, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6), accuracyM: accuracyM?.toFixed(2), speedKph: speedKph?.toFixed(2), heading: heading?.toFixed(2), odometer, source: String(data.source || "MANUAL").slice(0, 64), recordedAt, payload: data.payload && typeof data.payload === "object" ? data.payload : null },
    });
    if (odometer !== null && odometer > vehicle.odometerCurrent) await tx.vehicle.update({ where: { id: vehicleId }, data: { odometerCurrent: odometer } });
    return location;
  });
}

async function listLocations(tenantId, vehicleId, { from, to, limit = 200 } = {}) {
  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) throw validationError("limit must be between 1 and 1000");
  const recordedAt = {};
  if (from) { const value = new Date(from); if (Number.isNaN(value.getTime())) throw validationError("from is invalid"); recordedAt.gte = value; }
  if (to) { const value = new Date(to); if (Number.isNaN(value.getTime())) throw validationError("to is invalid"); recordedAt.lte = value; }
  return prisma.vehicleLocation.findMany({ where: { tenantId, vehicleId, ...(Object.keys(recordedAt).length ? { recordedAt } : {}) }, orderBy: { recordedAt: "desc" }, take: parsedLimit });
}

async function getLatestLocation(tenantId, vehicleId) {
  return prisma.vehicleLocation.findFirst({ where: { tenantId, vehicleId }, orderBy: { recordedAt: "desc" } });
}

module.exports = { ingestLocation, listLocations, getLatestLocation };
