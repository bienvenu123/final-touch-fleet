const DEFAULT_ESCALATION_THRESHOLD_MS = 2 * 60 * 60 * 1000;

function thresholdMsFromTenant(tenant) {
  const configured = tenant?.bookingEscalationThresholdMs;
  if (configured === undefined || configured === null) {
    return DEFAULT_ESCALATION_THRESHOLD_MS;
  }
  return Number(configured);
}

function computeEscalationScheduledFor(submittedAt, thresholdMs) {
  return new Date(submittedAt.getTime() + thresholdMs);
}

function requiresImmediateDepartureAlert(now, departureAt, thresholdMs) {
  const remainingMs = departureAt.getTime() - now.getTime();
  return remainingMs > 0 && remainingMs < thresholdMs;
}

function resolveEscalationTarget({ backupApprover, owner, superAdmins }) {
  const validBackup = backupApprover?.isActive && backupApprover.email ? backupApprover : null;
  const validOwner = owner?.isActive && owner.email ? owner : null;
  const validSuperAdmin = (superAdmins || []).find(
    (user) => user?.isActive && user.email
  ) || null;

  if (validBackup) return validBackup;
  if (validOwner) return validOwner;
  return validSuperAdmin;
}

module.exports = {
  DEFAULT_ESCALATION_THRESHOLD_MS,
  thresholdMsFromTenant,
  computeEscalationScheduledFor,
  requiresImmediateDepartureAlert,
  resolveEscalationTarget,
};
