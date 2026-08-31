const CORE_ENTITY_PREFIXES = [
  ["/api/bookings", "BOOKING"],
  ["/bookings", "BOOKING"],
  ["/api/vehicles", "VEHICLE"],
  ["/fleet/vehicles", "VEHICLE"],
  ["/fleet/maintenance", "MAINTENANCE"],
  ["/departments", "DEPARTMENT"],
  ["/tenants", "TENANT"],
  ["/auth", "USER"],
];

const ENTITY_ID_PARAM_KEYS = [
  "bookingId",
  "vehicleId",
  "departmentId",
  "tenantId",
  "userId",
  "id",
];

function entityFromPath(path) {
  for (const [prefix, entityType] of CORE_ENTITY_PREFIXES) {
    if (path.startsWith(prefix)) return entityType;
  }
  return null;
}

function entityIdFromParams(params = {}) {
  for (const key of ENTITY_ID_PARAM_KEYS) {
    if (params[key]) return params[key];
  }
  return null;
}

function actionFor(req, entityType) {
  if (req.path.includes("approval")) return "APPROVE";
  if (req.path.includes("rejection")) return "REJECT";
  if (req.path.includes("override")) return "OVERRIDE";
  if (req.path.includes("retire") || req.path.includes("deletion")) return "DELETE";
  return (
    { POST: "CREATE", GET: "READ", PATCH: "UPDATE", PUT: "UPDATE", DELETE: "DELETE" }[
      req.method
    ] || "ACCESS"
  );
}

function resolveActor(req) {
  const actor = req.user;
  return {
    actorId: actor?.userId ?? actor?.id ?? null,
    actorEmail: actor?.email ?? req.body?.email ?? null,
    tenantId: actor?.tenantId ?? req.body?.tenantId ?? null,
  };
}

function isSecurityAttempt(req, statusCode) {
  if (req.user) return false;
  return (
    req.path.startsWith("/auth") ||
    statusCode === 401 ||
    statusCode === 403
  );
}

function shouldAudit(req, statusCode) {
  if (req.path.startsWith("/api/audit-logs")) return false;
  const entityType = entityFromPath(req.path);
  return Boolean(entityType || isSecurityAttempt(req, statusCode));
}

function buildAuditEntry(req, res, startedAt) {
  const entityType = req.auditMeta?.entityType ?? entityFromPath(req.path);
  const security = isSecurityAttempt(req, res.statusCode);
  const { actorId, actorEmail, tenantId } = resolveActor(req);

  const action = security
    ? `SECURITY_${res.statusCode >= 400 ? "DENIED" : "ATTEMPT"}`
    : req.auditMeta?.action ?? actionFor(req, entityType);

  const metadata = {
    params: req.params,
    query: req.query,
    body: req.body,
    durationMs: Date.now() - startedAt,
    ...(req.auditMeta?.metadata ?? {}),
  };

  if (security) {
    metadata.routePayload = { body: req.body, query: req.query, params: req.params };
  }

  return {
    tenantId: req.auditMeta?.tenantId ?? tenantId,
    actorId: req.auditMeta?.actorId ?? actorId,
    actorEmail: req.auditMeta?.actorEmail ?? actorEmail,
    category: security ? "SECURITY" : req.auditMeta?.category ?? "AUDIT",
    action,
    entityType: req.auditMeta?.entityType ?? entityType,
    entityId: req.auditMeta?.entityId ?? entityIdFromParams(req.params),
    method: req.method,
    route: req.originalUrl.split("?")[0],
    statusCode: res.statusCode,
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    metadata,
  };
}

module.exports = {
  entityFromPath,
  entityIdFromParams,
  actionFor,
  resolveActor,
  isSecurityAttempt,
  shouldAudit,
  buildAuditEntry,
};
