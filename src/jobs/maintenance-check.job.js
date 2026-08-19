const { findVehiclesApproachingMaintenance } = require("../services/maintenance.service");
const { runComplianceAlertScan } = require("../services/compliance-alert.service");
const { registerReminderWorker } = require("../services/notification.service");
const { registerBookingEscalationWorker } = require("../services/booking-escalation.service");
const { registerRentalOverdueWorker, scheduleRentalOverdueJob: scheduleRentalOverdueWorker } = require("../services/rentalReservation.service");
const { registerRentalReportWorker } = require("../jobs/rental-report.job");

const MAINTENANCE_CHECK_JOB = "maintenance-check";
const COMPLIANCE_ALERT_JOB = "daily-compliance-alerts";
const RENTAL_OVERDUE_JOB = "rental-overdue-scan";
const RENTAL_REPORT_JOB = "rental-performance-report";

// pg-boss integration point. Call this during worker startup after constructing pg-boss.
// The handler can be extended to notify the relevant fleet managers.
function registerMaintenanceCheckJob(boss) {
  return boss.work(MAINTENANCE_CHECK_JOB, async (job) => {
    const { tenantId, days, mileage } = job.data;
    return findVehiclesApproachingMaintenance(tenantId, { days, mileage });
  });
}

function scheduleMaintenanceCheck(boss, tenantId, cron = "0 6 * * *") {
  return boss.schedule(MAINTENANCE_CHECK_JOB, cron, { tenantId });
}

// Register once at worker startup. It scans all active fleet records daily at 06:00.
function registerComplianceAlertJob(boss) {
  return boss.work(COMPLIANCE_ALERT_JOB, (job) => runComplianceAlertScan(boss, job.data || {}));
}

function scheduleComplianceAlertJob(boss, cron = "0 6 * * *") {
  return boss.schedule(COMPLIANCE_ALERT_JOB, cron, {});
}

function registerRentalOverdueJob(boss) {
  return registerRentalOverdueWorker(boss);
}

function scheduleRentalOverdueJob(boss, cron = "0 * * * *") {
  return scheduleRentalOverdueWorker(boss, cron);
}

// Application worker bootstrap: call after `await boss.start()`.
async function registerFleetBackgroundJobs(boss, { complianceCron = "0 6 * * *", overdueCron = "0 * * * *" } = {}) {
  const queues = [
    "booking-escalation",
    "rental-overdue-scan",
    "notification-reminder",
    "daily-compliance-alerts",
    "rental-performance-report",
    "maintenance-check"
  ];
  for (const queue of queues) {
    await boss.createQueue(queue).catch((err) => {
      console.warn(`Failed to create queue "${queue}":`, err.message);
    });
  }

  await registerReminderWorker(boss);
  await registerBookingEscalationWorker(boss);
  await registerRentalOverdueJob(boss);
  await registerRentalReportWorker(boss);
  await registerComplianceAlertJob(boss);
  await scheduleComplianceAlertJob(boss, complianceCron);
  await scheduleRentalOverdueJob(boss, overdueCron);
}

module.exports = { MAINTENANCE_CHECK_JOB, COMPLIANCE_ALERT_JOB, registerMaintenanceCheckJob, scheduleMaintenanceCheck, registerComplianceAlertJob, scheduleComplianceAlertJob, registerFleetBackgroundJobs };
