const prisma = require("../config/prisma");
const { dueStatus } = require("./maintenance.service");
const { scheduleReminder } = require("./notification.service");

const DEFAULT_LICENCE_WARNING_DAYS = 30;
const ALERT_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

function expiryState(expiry, warningDays) {
  const now = new Date();
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + warningDays);
  return expiry < now ? "EXPIRED" : expiry <= threshold ? "EXPIRING" : null;
}

async function wasAlertSentRecently(tenantId, dedupKey) {
  return prisma.notification.findFirst({
    where: { tenantId, dedupKey, status: "SENT", sentAt: { gte: new Date(Date.now() - ALERT_DEDUP_WINDOW_MS) } },
    select: { id: true },
  });
}

async function sendManagerAlert({ boss, tenantId, managers, dedupKey, subject, message, payload }) {
  if (await wasAlertSentRecently(tenantId, dedupKey)) return { sent: 0, suppressed: true };

  // A separate notification per manager makes delivery/audit status recipient-specific.
  const results = await Promise.all(managers.map((manager) => scheduleReminder({
    boss,
    tenantId,
    targetDatetime: new Date(),
    offsetMs: 0,
    channel: "EMAIL",
    recipient: manager.email,
    subject,
    message,
    payload,
    dedupKey,
  })));
  return { sent: results.length, suppressed: false };
}

async function runComplianceAlertScan(boss, { maintenanceDays = 30, maintenanceMileage = 1000, licenceWarningDays = DEFAULT_LICENCE_WARNING_DAYS } = {}) {
  const [managers, vehicles, drivers] = await Promise.all([
    prisma.user.findMany({ where: { role: "FLEET_MANAGER", isActive: true }, select: { tenantId: true, email: true } }),
    prisma.vehicle.findMany({
      where: { retiredAt: null, OR: [{ nextDueDate: { not: null } }, { nextDueMileage: { not: null } }] },
      orderBy: { registration: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "DRIVER", isActive: true, licenceExpiry: { not: null, lte: new Date(Date.now() + licenceWarningDays * 86400000) } },
      select: { id: true, tenantId: true, name: true, licenceExpiry: true },
    }),
  ]);
  const managersByTenant = new Map();
  for (const manager of managers) managersByTenant.set(manager.tenantId, [...(managersByTenant.get(manager.tenantId) || []), manager]);

  const summary = { maintenanceAlerts: 0, licenceAlerts: 0, suppressed: 0, skippedWithoutManagers: 0 };
  for (const vehicle of vehicles) {
    const status = dueStatus(vehicle, { days: maintenanceDays, mileage: maintenanceMileage });
    if (status.status === "ON_TRACK") continue;
    const managersForTenant = managersByTenant.get(vehicle.tenantId) || [];
    if (!managersForTenant.length) { summary.skippedWithoutManagers += 1; continue; }
    const result = await sendManagerAlert({
      boss, tenantId: vehicle.tenantId, managers: managersForTenant, dedupKey: `maintenance:${vehicle.id}`,
      subject: `Vehicle maintenance ${status.status.toLowerCase()}: ${vehicle.registration}`,
      message: `Vehicle ${vehicle.registration} is ${status.status.toLowerCase()} for maintenance.`,
      payload: { alertType: "MAINTENANCE_DUE", vehicleId: vehicle.id, registration: vehicle.registration, status },
    });
    if (result.suppressed) summary.suppressed += 1; else summary.maintenanceAlerts += result.sent;
  }

  for (const driver of drivers) {
    const state = expiryState(driver.licenceExpiry, licenceWarningDays);
    if (!state) continue;
    const managersForTenant = managersByTenant.get(driver.tenantId) || [];
    if (!managersForTenant.length) { summary.skippedWithoutManagers += 1; continue; }
    const result = await sendManagerAlert({
      boss, tenantId: driver.tenantId, managers: managersForTenant, dedupKey: `licence:${driver.id}`,
      subject: `Driver licence ${state.toLowerCase()}: ${driver.name}`,
      message: `${driver.name}'s driving licence is ${state.toLowerCase()} on ${driver.licenceExpiry.toISOString().slice(0, 10)}.`,
      payload: { alertType: "LICENCE_EXPIRY", driverId: driver.id, licenceExpiry: driver.licenceExpiry, status: state },
    });
    if (result.suppressed) summary.suppressed += 1; else summary.licenceAlerts += result.sent;
  }
  return summary;
}

module.exports = { DEFAULT_LICENCE_WARNING_DAYS, ALERT_DEDUP_WINDOW_MS, runComplianceAlertScan };
