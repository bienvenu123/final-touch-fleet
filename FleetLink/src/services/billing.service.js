const prisma = require("../config/prisma");

function validationError(message) { const error = new Error(message); error.statusCode = 400; return error; }

async function getVehicleBilling(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, currency: true, vehicleLimit: true, vehicleRateCents: true, billingStatus: true } });
  if (!tenant) { const error = new Error("Tenant not found"); error.statusCode = 404; throw error; }
  const activeVehicleCount = await prisma.vehicle.count({ where: { tenantId, retiredAt: null } });
  const rateCents = tenant.vehicleRateCents || 0;
  return { ...tenant, activeVehicleCount, includedVehicles: tenant.vehicleLimit, overageVehicles: tenant.vehicleLimit === null ? 0 : Math.max(0, activeVehicleCount - tenant.vehicleLimit), monthlyAmountCents: activeVehicleCount * rateCents };
}

async function updateVehicleBilling(tenantId, data = {}) {
  const update = {};
  if (data.vehicleLimit !== undefined) {
    if (data.vehicleLimit !== null && (!Number.isInteger(Number(data.vehicleLimit)) || Number(data.vehicleLimit) < 0)) throw validationError("vehicleLimit must be a non-negative whole number or null");
    update.vehicleLimit = data.vehicleLimit === null ? null : Number(data.vehicleLimit);
  }
  if (data.vehicleRateCents !== undefined) {
    if (!Number.isInteger(Number(data.vehicleRateCents)) || Number(data.vehicleRateCents) < 0) throw validationError("vehicleRateCents must be a non-negative whole number");
    update.vehicleRateCents = Number(data.vehicleRateCents);
  }
  if (!Object.keys(update).length) throw validationError("vehicleLimit or vehicleRateCents is required");
  await prisma.tenant.update({ where: { id: tenantId }, data: update });
  return getVehicleBilling(tenantId);
}

async function enforceVehicleLimit(tenantId) {
  const billing = await getVehicleBilling(tenantId);
  if (billing.billingStatus !== "ACTIVE") { const error = new Error("Tenant billing is not active"); error.statusCode = 402; throw error; }
  if (billing.includedVehicles !== null && billing.activeVehicleCount >= billing.includedVehicles) { const error = new Error(`Vehicle limit of ${billing.includedVehicles} reached`); error.statusCode = 402; error.billing = billing; throw error; }
}

module.exports = { getVehicleBilling, updateVehicleBilling, enforceVehicleLimit };
