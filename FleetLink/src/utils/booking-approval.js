const prisma = require("../config/prisma");
const { resolveEscalationTarget } = require("./booking-escalation");

function requiresMultiLevelApproval(tenant) {
  const configured = getConfiguredApprovalLevels(tenant);
  const eligibleTenant = tenant?.sector === "Public Sector" || ["Professional", "Enterprise"].includes(tenant?.package);
  if (!eligibleTenant) return false;
  if (configured) return configured.length > 1;
  return tenant?.package === "Enterprise" || tenant?.sector === "Public Sector";
}

function getConfiguredApprovalLevels(tenant) {
  const levels = tenant?.approvalWorkflow?.levels;
  const allowed = new Set(["DEPARTMENT_HEAD", "FLEET_MANAGER", "SUPER_ADMIN"]);
  if (!Array.isArray(levels) || !levels.length || levels.some(role => !allowed.has(role))) return null;
  if (levels.length > 1 && tenant?.sector !== "Public Sector" && !["Professional", "Enterprise"].includes(tenant?.package)) return null;
  return [...new Set(levels)];
}

function getApprovalStepLabel(role) {
  switch (role) {
    case "DEPARTMENT_HEAD":
      return "Department Head";
    case "FLEET_MANAGER":
      return "Fleet Manager";
    case "SUPER_ADMIN":
      return "Super Admin";
    default:
      return role || "Approver";
  }
}

function buildApprovalTrailEvent({ step, actorId, actorName, actorEmail, actorRole, action, comment = null, auto = false }) {
  return {
    step,
    actorId,
    actorName,
    actorEmail,
    actorRole,
    action,
    comment,
    auto,
    timestamp: new Date().toISOString(),
  };
}

async function findDepartmentHead(tenantId, departmentId) {
  if (!departmentId) {
    return null;
  }
  return prisma.user.findFirst({
    where: {
      tenantId,
      departmentId,
      role: "DEPARTMENT_HEAD",
      isActive: true,
    },
    select: { id: true, email: true, name: true, role: true, departmentId: true },
  });
}

async function findFleetManager(tenantId) {
  return prisma.user.findFirst({
    where: {
      tenantId,
      role: "FLEET_MANAGER",
      isActive: true,
    },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });
}

async function findFallbackApprover(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      owner: { select: { id: true, email: true, name: true, role: true, isActive: true } },
      backupApprover: { select: { id: true, email: true, name: true, role: true, isActive: true } },
    },
  });

  const superAdmins = await prisma.user.findMany({
    where: { tenantId, role: "SUPER_ADMIN", isActive: true },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });

  return resolveEscalationTarget({
    backupApprover: tenant?.backupApprover,
    owner: tenant?.owner,
    superAdmins,
  });
}

async function resolveInitialApprover({ tenant, departmentId, requesterId, requesterRole }) {
  const configured = getConfiguredApprovalLevels(tenant);
  const levels = configured || (requiresMultiLevelApproval(tenant) ? ["DEPARTMENT_HEAD", "FLEET_MANAGER"] : ["FLEET_MANAGER"]);
  for (const role of levels) {
    let candidate = role === "DEPARTMENT_HEAD" ? await findDepartmentHead(tenant.id, departmentId)
      : role === "FLEET_MANAGER" ? await findFleetManager(tenant.id)
      : (await findFallbackApprover(tenant.id));
    if (candidate && candidate.id !== requesterId) return candidate;
  }
  return findFallbackApprover(tenant.id);
}

async function resolveNextApprover({ tenant, currentApproverRole, tenantId, bookingId }) {
  const configured = getConfiguredApprovalLevels(tenant);
  const levels = configured || (requiresMultiLevelApproval(tenant) ? ["DEPARTMENT_HEAD", "FLEET_MANAGER"] : ["FLEET_MANAGER"]);
  const currentIndex = levels.indexOf(currentApproverRole);
  if (currentIndex < 0) return null;
  const nextRole = levels[currentIndex + 1];
  if (nextRole) {
    if (nextRole === "DEPARTMENT_HEAD") {
      const booking = await prisma.booking.findFirst({ where: { id: bookingId, tenantId }, select: { requestedBy: { select: { departmentId: true } } } });
      return (await findDepartmentHead(tenantId, booking?.requestedBy?.departmentId)) || findFallbackApprover(tenantId);
    }
    if (nextRole === "FLEET_MANAGER") return (await findFleetManager(tenantId)) || findFallbackApprover(tenantId);
    return findFallbackApprover(tenantId);
  }
  return null;
}

module.exports = {
  requiresMultiLevelApproval,
  getConfiguredApprovalLevels,
  getApprovalStepLabel,
  buildApprovalTrailEvent,
  findDepartmentHead,
  findFleetManager,
  resolveInitialApprover,
  resolveNextApprover,
};
