const assert = require("assert");
const {
  entityFromPath,
  entityIdFromParams,
  actionFor,
  resolveActor,
  isSecurityAttempt,
  shouldAudit,
  buildAuditEntry,
} = require("./utils/audit-log.helpers");
const { compactMetadata } = require("./utils/audit-log-metadata");

function mockReq(overrides = {}) {
  return {
    method: "POST",
    path: "/fleet/vehicles",
    originalUrl: "/fleet/vehicles",
    params: {},
    query: {},
    body: {},
    ip: "203.0.113.10",
    socket: { remoteAddress: "::1" },
    user: undefined,
    auditMeta: undefined,
    ...overrides,
  };
}

function mockRes(statusCode = 201) {
  return { statusCode };
}

// --- entityFromPath ---
assert.strictEqual(entityFromPath("/bookings/abc/approval"), "BOOKING");
assert.strictEqual(entityFromPath("/fleet/vehicles/123/service-records"), "VEHICLE");
assert.strictEqual(entityFromPath("/departments"), "DEPARTMENT");
assert.strictEqual(entityFromPath("/health"), null);

// --- entityIdFromParams ---
assert.strictEqual(entityIdFromParams({ vehicleId: "v1" }), "v1");
assert.strictEqual(entityIdFromParams({ bookingId: "b1", id: "fallback" }), "b1");

// --- actionFor ---
assert.strictEqual(actionFor({ method: "POST", path: "/bookings/1/approval" }, "BOOKING"), "APPROVE");
assert.strictEqual(actionFor({ method: "POST", path: "/bookings/1/rejection" }, "BOOKING"), "REJECT");
assert.strictEqual(actionFor({ method: "PATCH", path: "/bookings/1/override" }, "BOOKING"), "OVERRIDE");
assert.strictEqual(actionFor({ method: "DELETE", path: "/bookings/1" }, "BOOKING"), "DELETE");
assert.strictEqual(actionFor({ method: "POST", path: "/fleet/vehicles" }, "VEHICLE"), "CREATE");

// --- resolveActor ---
assert.deepStrictEqual(
  resolveActor(mockReq({ user: { userId: "u1", email: "a@b.com", tenantId: "t1" } })),
  { actorId: "u1", actorEmail: "a@b.com", tenantId: "t1" }
);
assert.deepStrictEqual(
  resolveActor(mockReq({ body: { email: "anon@b.com", tenantId: "t2" } })),
  { actorId: null, actorEmail: "anon@b.com", tenantId: "t2" }
);

// --- security detection ---
assert.strictEqual(isSecurityAttempt(mockReq({ path: "/auth/login" }), 401), true);
assert.strictEqual(isSecurityAttempt(mockReq({ path: "/fleet/vehicles" }), 401), true);
assert.strictEqual(isSecurityAttempt(mockReq({ user: { userId: "u1" } }), 403), false);
assert.strictEqual(shouldAudit(mockReq({ path: "/api/audit-logs" }), 200), false);

// --- buildAuditEntry: authenticated CRUD ---
{
  const req = mockReq({
    user: { userId: "u1", email: "mgr@fleet.gov", tenantId: "t1" },
    params: { vehicleId: "veh-1" },
    body: { registration: "ABC123" },
  });
  const entry = buildAuditEntry(req, mockRes(201), Date.now() - 12);
  assert.strictEqual(entry.category, "AUDIT");
  assert.strictEqual(entry.action, "CREATE");
  assert.strictEqual(entry.entityType, "VEHICLE");
  assert.strictEqual(entry.entityId, "veh-1");
  assert.strictEqual(entry.actorId, "u1");
  assert.strictEqual(entry.ipAddress, "203.0.113.10");
  assert.ok(!entry.metadata.routePayload);
}

// --- buildAuditEntry: unauthenticated security ---
{
  const req = mockReq({
    path: "/auth/login",
    originalUrl: "/auth/login",
    body: { email: "bad@actor.com", password: "secret" },
  });
  const entry = buildAuditEntry(req, mockRes(401), Date.now() - 5);
  assert.strictEqual(entry.category, "SECURITY");
  assert.strictEqual(entry.action, "SECURITY_DENIED");
  assert.strictEqual(entry.actorEmail, "bad@actor.com");
  assert.deepStrictEqual(entry.metadata.routePayload.body.email, "bad@actor.com");
  assert.strictEqual(entry.metadata.body.password, "secret");
}

// --- buildAuditEntry: explicit auditMeta override ---
{
  const req = mockReq({
    user: { userId: "u1", email: "mgr@fleet.gov", tenantId: "t1" },
    auditMeta: { action: "APPROVE", entityType: "BOOKING", entityId: "bk-99" },
  });
  const entry = buildAuditEntry(req, mockRes(200), Date.now());
  assert.strictEqual(entry.action, "APPROVE");
  assert.strictEqual(entry.entityType, "BOOKING");
  assert.strictEqual(entry.entityId, "bk-99");
}

// --- compactMetadata: redaction and truncation ---
{
  const compact = compactMetadata({
    body: { password: "x", note: "ok" },
    query: { page: "1" },
  });
  assert.strictEqual(compact.body.password, "[REDACTED]");
  assert.strictEqual(compact.body.note, "ok");
}

{
  const large = { payload: "x".repeat(20_000) };
  const compact = compactMetadata(large);
  assert.ok(compact.truncated === true || compact.payload.includes("[TRUNCATED]"));
}

console.log("Audit log tests passed.");
