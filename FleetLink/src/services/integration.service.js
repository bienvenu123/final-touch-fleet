const crypto = require("crypto");
const prisma = require("../config/prisma");
const { getDepartmentRoi } = require("./analytics.service");
const { ingestLocation } = require("./telematics.service");

const ALLOWED_SCOPES = new Set(["telematics:write", "hr:write", "erp:write", "erp:read", "sync:read"]);
const SYNC_LIMIT = 1000;

function integrationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function safeName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 100) throw integrationError("Integration key name is required and must be at most 100 characters");
  return name;
}

async function createApiKey(tenantId, { name, scopes } = {}) {
  const normalizedScopes = [...new Set(Array.isArray(scopes) ? scopes : [])];
  if (!normalizedScopes.length || normalizedScopes.some(scope => !ALLOWED_SCOPES.has(scope))) {
    throw integrationError(`scopes must be selected from: ${[...ALLOWED_SCOPES].join(", ")}`);
  }
  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString("hex");
  const secretHash = crypto.createHash("sha256").update(secret).digest("hex");
  const apiKey = await prisma.integrationApiKey.create({
    data: { id, tenantId, name: safeName(name), secretHash, scopes: normalizedScopes },
    select: { id: true, name: true, scopes: true, createdAt: true },
  });
  return { ...apiKey, key: `flk_${id}.${secret}` };
}

async function listApiKeys(tenantId) {
  return prisma.integrationApiKey.findMany({
    where: { tenantId }, select: { id: true, name: true, scopes: true, createdAt: true, lastUsedAt: true, revokedAt: true },
    orderBy: { createdAt: "desc" },
  });
}

async function revokeApiKey(tenantId, id) {
  const result = await prisma.integrationApiKey.updateMany({ where: { id, tenantId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!result.count) throw integrationError("Integration key not found or already revoked", 404);
  return { id, revoked: true };
}

async function authenticateApiKey(value, requiredScope) {
  const match = /^flk_([0-9a-f-]{36})\.([a-f0-9]{64})$/i.exec(value || "");
  if (!match) return null;
  const key = await prisma.integrationApiKey.findFirst({ where: { id: match[1], revokedAt: null } });
  if (!key) return null;
  const presented = Buffer.from(crypto.createHash("sha256").update(match[2]).digest("hex"), "hex");
  const expected = Buffer.from(key.secretHash, "hex");
  if (presented.length !== expected.length || !crypto.timingSafeEqual(presented, expected)) return null;
  if (!key.scopes.includes(requiredScope)) throw integrationError(`Integration key lacks the ${requiredScope} scope`, 403);
  await prisma.integrationApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return { id: key.id, name: key.name, tenantId: key.tenantId, scopes: key.scopes };
}

async function runSync({ tenantId, provider, syncType, received }, work) {
  const run = await prisma.integrationSyncRun.create({ data: { tenantId, provider, syncType, status: "RUNNING", received } });
  try {
    const result = await work();
    const counts = { processed: Number(result.processed || 0), skipped: Number(result.skipped || 0) };
    await prisma.integrationSyncRun.update({ where: { id: run.id }, data: { ...counts, status: "SUCCEEDED", completedAt: new Date() } });
    return { syncRunId: run.id, ...counts, ...result };
  } catch (error) {
    await prisma.integrationSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", error: String(error.message).slice(0, 1000), completedAt: new Date() } });
    throw error;
  }
}

function boundedRows(rows, label) {
  if (!Array.isArray(rows) || rows.length > SYNC_LIMIT) throw integrationError(`${label} must be a list of at most ${SYNC_LIMIT} records`);
  return rows;
}

async function syncTelematics(tenantId, payload = {}) {
  const rows = boundedRows(Array.isArray(payload.locations) ? payload.locations : [payload], "locations");
  return runSync({ tenantId, provider: "TELEMATICS", syncType: "LOCATION_IMPORT", received: rows.length }, async () => {
    let processed = 0, skipped = 0;
    for (const row of rows) {
      const externalId = String(row.vehicleExternalId || "").trim();
      const registration = String(row.registration || "").trim();
      const vehicle = row.vehicleId
        ? await prisma.vehicle.findFirst({ where: { id: row.vehicleId, tenantId, retiredAt: null }, select: { id: true } })
        : externalId
          ? await prisma.vehicle.findFirst({ where: { tenantId, externalSource: "TELEMATICS", externalId, retiredAt: null }, select: { id: true } })
          : registration
            ? await prisma.vehicle.findFirst({ where: { tenantId, registration, retiredAt: null }, select: { id: true } })
            : null;
      if (!vehicle) { skipped += 1; continue; }
      const externalEventId = row.eventId ? String(row.eventId).slice(0, 200) : null;
      if (externalEventId) {
        const duplicate = await prisma.vehicleLocation.findFirst({ where: { tenantId, source: "TELEMATICS", externalEventId }, select: { id: true } });
        if (duplicate) { skipped += 1; continue; }
      }
      try {
        await ingestLocation(tenantId, { ...row, vehicleId: vehicle.id, source: "TELEMATICS", externalEventId });
        processed += 1;
      } catch (error) {
        if (error.code === "P2002" && externalEventId) { skipped += 1; continue; }
        throw error;
      }
    }
    return { processed, skipped };
  });
}

async function mapTelematicsVehicles(tenantId, payload = {}) {
  const rows = boundedRows(payload.mappings, "mappings");
  return runSync({ tenantId, provider: "TELEMATICS", syncType: "VEHICLE_MAPPING", received: rows.length }, async () => {
    let processed = 0, skipped = 0;
    for (const row of rows) {
      const externalId = text(row.externalId, "vehicle externalId", { required: true, max: 200 });
      const registration = text(row.registration, "vehicle registration", { required: true, max: 64 });
      const vehicle = await prisma.vehicle.findFirst({ where: { tenantId, registration, retiredAt: null }, select: { id: true } });
      if (!vehicle) { skipped += 1; continue; }
      await prisma.vehicle.update({ where: { id: vehicle.id }, data: { externalSource: "TELEMATICS", externalId } });
      processed += 1;
    }
    return { processed, skipped };
  });
}

function text(value, field, { required = false, max = 200 } = {}) {
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw integrationError(`${field} is required`);
  if (result.length > max) throw integrationError(`${field} must be at most ${max} characters`);
  return result || null;
}

async function upsertDepartment(tenantId, source, row) {
  const externalId = text(row.externalId, "department externalId", { required: true, max: 200 });
  const name = text(row.name, "department name", { required: true, max: 120 });
  const existing = await prisma.department.findFirst({ where: { tenantId, externalSource: source, externalId } });
  const byCostCentre = row.costCentreCode ? await prisma.department.findFirst({ where: { tenantId, costCentreCode: String(row.costCentreCode).trim() } }) : null;
  const target = existing || (source === "ERP" && byCostCentre);
  const data = {
    name,
    costCentreCode: text(row.costCentreCode, "costCentreCode", { max: 100 }),
    budgetCode: text(row.budgetCode, "budgetCode", { max: 100 }),
  };
  if (target) return prisma.department.update({ where: { id: target.id }, data: { ...data, ...(!target.externalId ? { externalSource: source, externalId } : {}) } });
  return prisma.department.create({ data: { tenantId, externalSource: source, externalId, ...data } });
}

async function syncHrSnapshot(tenantId, payload = {}) {
  const departments = boundedRows(payload.departments || [], "departments");
  const employees = boundedRows(payload.employees || [], "employees");
  if (departments.length + employees.length > SYNC_LIMIT) throw integrationError(`A sync request may contain at most ${SYNC_LIMIT} total records`);
  return runSync({ tenantId, provider: "HR", syncType: "ORGANIZATION_SNAPSHOT", received: departments.length + employees.length }, async () => {
    const departmentMap = new Map();
    let processed = 0, skipped = 0;
    for (const row of departments) {
      const department = await upsertDepartment(tenantId, "HR", row);
      departmentMap.set(String(row.externalId), department.id);
      processed += 1;
    }
    const unmatchedEmployees = [];
    for (const employee of employees) {
      const externalId = text(employee.externalId, "employee externalId", { required: true, max: 200 });
      const email = text(employee.email, "employee email", { required: true, max: 254 }).toLowerCase();
      const name = text(employee.name, "employee name", { required: true, max: 160 });
      let departmentId = employee.departmentExternalId ? departmentMap.get(String(employee.departmentExternalId)) : null;
      if (!departmentId && employee.departmentExternalId) {
        const department = await prisma.department.findFirst({ where: { tenantId, externalSource: "HR", externalId: String(employee.departmentExternalId) }, select: { id: true } });
        departmentId = department?.id || null;
      }
      const current = await prisma.user.findFirst({ where: { tenantId, externalSource: "HR", externalId } })
        || await prisma.user.findFirst({ where: { tenantId, email } });
      if (!current) { skipped += 1; unmatchedEmployees.push(email); continue; }
      const licenceExpiry = employee.licenceExpiry ? new Date(employee.licenceExpiry) : undefined;
      if (licenceExpiry && Number.isNaN(licenceExpiry.getTime())) throw integrationError(`Invalid licenceExpiry for ${email}`);
      await prisma.user.update({ where: { id: current.id }, data: {
        name, contact: text(employee.contact, "employee contact", { max: 80 }),
        ...(departmentId ? { departmentId } : {}),
        ...(licenceExpiry ? { licenceExpiry } : {}),
        externalSource: "HR", externalId,
      } });
      processed += 1;
    }
    return { processed, skipped, unmatchedEmployees };
  });
}

async function syncErpCostCentres(tenantId, payload = {}) {
  const rows = boundedRows(payload.costCentres, "costCentres");
  return runSync({ tenantId, provider: "ERP", syncType: "COST_CENTRE_IMPORT", received: rows.length }, async () => {
    let processed = 0;
    for (const row of rows) { await upsertDepartment(tenantId, "ERP", row); processed += 1; }
    return { processed, skipped: 0 };
  });
}

async function getErpDepartmentRoi(tenantId, range) {
  return getDepartmentRoi(tenantId, range);
}

async function listSyncRuns(tenantId, limit = 50) {
  const take = Math.max(1, Math.min(200, Number(limit) || 50));
  return prisma.integrationSyncRun.findMany({ where: { tenantId }, orderBy: { startedAt: "desc" }, take });
}

module.exports = { ALLOWED_SCOPES, createApiKey, listApiKeys, revokeApiKey, authenticateApiKey, syncTelematics, mapTelematicsVehicles, syncHrSnapshot, syncErpCostCentres, getErpDepartmentRoi, listSyncRuns };
