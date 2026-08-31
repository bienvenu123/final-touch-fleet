const prisma = require("../config/prisma");

const createTenant = async (data) => {
  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      sector: data.sector,
      package: data.package || "Starter",
      billingStatus: data.billingStatus,
      featureOverrides: data.featureOverrides || {},
    },
  });

  return {
    ...tenant,
    bookingEscalationThresholdMs: tenant.bookingEscalationThresholdMs != null ? Number(tenant.bookingEscalationThresholdMs) : tenant.bookingEscalationThresholdMs,
  };
};

const getTenantConfig = async (tenantId) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      backupApprover: { select: { id: true, name: true, email: true } },
    },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return {
    ...tenant,
    bookingEscalationThresholdMs: tenant.bookingEscalationThresholdMs != null ? Number(tenant.bookingEscalationThresholdMs) : tenant.bookingEscalationThresholdMs,
  };
};

const updateTenantConfig = async (tenantId, data) => {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.sector !== undefined) updateData.sector = data.sector;
  if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
  if (data.backupApproverId !== undefined) updateData.backupApproverId = data.backupApproverId;
  if (data.bookingEscalationThresholdMs !== undefined) updateData.bookingEscalationThresholdMs = BigInt(data.bookingEscalationThresholdMs);
  if (data.rentalLateFeeRatePercent !== undefined) updateData.rentalLateFeeRatePercent = data.rentalLateFeeRatePercent;
  if (data.featureOverrides !== undefined) updateData.featureOverrides = data.featureOverrides;

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      backupApprover: { select: { id: true, name: true, email: true } },
    },
  });

  return {
    ...tenant,
    bookingEscalationThresholdMs: tenant.bookingEscalationThresholdMs != null ? Number(tenant.bookingEscalationThresholdMs) : tenant.bookingEscalationThresholdMs,
  };
};

module.exports = {
  createTenant,
  getTenantConfig,
  updateTenantConfig,
};