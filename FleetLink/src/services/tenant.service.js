const prisma = require("../config/prisma");

const createTenant = async (data) => {

    const tenant = await prisma.tenant.create({
        data: {
            name: data.name,
            sector: data.sector,
            package: data.package || "Starter",
            billingStatus: data.billingStatus,
            featureOverrides: data.featureOverrides || {},
        }
    });

    return {
        ...tenant,
        bookingEscalationThresholdMs: tenant.bookingEscalationThresholdMs != null ? Number(tenant.bookingEscalationThresholdMs) : tenant.bookingEscalationThresholdMs,
    };
};

const listTenants = async () => prisma.tenant.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true, vehicles: true, departments: true } } } });

const updateTenant = async (tenantId, data) => {
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) { const error = new Error("Tenant not found"); error.statusCode = 404; throw error; }
    const updates = {};
    if (data.name !== undefined) { if (!String(data.name).trim()) { const error = new Error("name is required"); error.statusCode = 400; throw error; } updates.name = String(data.name).trim(); }
    if (data.sector !== undefined) { if (!String(data.sector).trim()) { const error = new Error("sector is required"); error.statusCode = 400; throw error; } updates.sector = String(data.sector).trim(); }
    if (data.package !== undefined) updates.package = String(data.package).trim();
    if (data.billingStatus !== undefined) updates.billingStatus = String(data.billingStatus).trim();
    return prisma.tenant.update({ where: { id: tenantId }, data: updates });
};

const deleteTenant = async (tenantId) => {
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { _count: { select: { users: true, vehicles: true, departments: true, bookings: true, reservations: true, customers: true } } } });
    if (!existing) { const error = new Error("Tenant not found"); error.statusCode = 404; throw error; }
    if (Object.values(existing._count).some(Boolean)) { const error = new Error("Tenant with operational data cannot be deleted"); error.statusCode = 400; throw error; }
    return prisma.tenant.delete({ where: { id: tenantId } });
};

async function getTenantConfig(tenantId) {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            owner: { select: { id: true, name: true, email: true } },
            backupApprover: { select: { id: true, name: true, email: true } },
        },
    });
    if (!tenant) { const error = new Error("Tenant not found"); error.statusCode = 404; throw error; }
    return { ...tenant, bookingEscalationThresholdMs: tenant.bookingEscalationThresholdMs != null ? Number(tenant.bookingEscalationThresholdMs) : null };
}

async function updateTenantConfig(tenantId, data) {
    const updates = {};
    for (const field of ["name", "sector", "ownerId", "backupApproverId", "rentalLateFeeRatePercent", "featureOverrides", "approvalWorkflow", "notificationSettings", "notificationTemplates", "customFields", "roleConfiguration", "integrationSettings", "locale", "currency"]) {
        if (data[field] !== undefined) updates[field] = data[field];
    }
    if (data.bookingEscalationThresholdMs !== undefined) {
        try { updates.bookingEscalationThresholdMs = BigInt(data.bookingEscalationThresholdMs); }
        catch { const error = new Error("bookingEscalationThresholdMs must be an integer"); error.statusCode = 400; throw error; }
    }
    const tenant = await prisma.tenant.update({
        where: { id: tenantId }, data: updates,
        include: { owner: { select: { id: true, name: true, email: true } }, backupApprover: { select: { id: true, name: true, email: true } } },
    });
    return { ...tenant, bookingEscalationThresholdMs: tenant.bookingEscalationThresholdMs != null ? Number(tenant.bookingEscalationThresholdMs) : null };
}

module.exports = { createTenant, listTenants, updateTenant, deleteTenant, getTenantConfig, updateTenantConfig };
