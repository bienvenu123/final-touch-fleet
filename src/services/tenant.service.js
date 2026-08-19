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

module.exports = {
    createTenant
};