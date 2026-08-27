const prisma = require("../config/prisma");
const { resolveEscalationTarget } = require("./booking-escalation");

function requiresMultiLevelApproval(tenant) {
  return tenant?.package === "Enterprise" || tenant?.sector === "Public Sector";
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
  const deptHead = await findDepartmentHead(tenant.id, departmentId);
  const fleetManager = await findFleetManager(tenant.id);

  if (requiresMultiLevelApproval(tenant) && deptHead) {
    if (deptHead.id === requesterId && requesterRole === "DEPARTMENT_HEAD") {
      return fleetManager || (await findFallbackApprover(tenant.id));
    }
    return deptHead;
  }

  return fleetManager || (await findFallbackApprover(tenant.id));
}

async function resolveNextApprover({ tenant, currentApproverRole, tenantId }) {
  if (requiresMultiLevelApproval(tenant) && currentApproverRole === "DEPARTMENT_HEAD") {
    const fleetManager = await findFleetManager(tenantId);
    return fleetManager || (await findFallbackApprover(tenantId));
  }
  return null;
}

module.exports = {
  requiresMultiLevelApproval,
  getApprovalStepLabel,
  buildApprovalTrailEvent,
  findDepartmentHead,
  findFleetManager,
  resolveInitialApprover,
  resolveNextApprover,
};
