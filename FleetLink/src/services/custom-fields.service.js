const prisma = require("../config/prisma");

const TYPES = new Set(["string", "number", "boolean", "date", "select"]);

function validateDefinitions(customFields = {}) {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) throw new Error("customFields must be an object");
  for (const [entity, definitions] of Object.entries(customFields)) {
    if (!Array.isArray(definitions)) throw new Error(`customFields.${entity} must be an array of field definitions`);
    const keys = new Set();
    for (const field of definitions) {
      if (!field || typeof field !== "object" || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(field.key || "") || !TYPES.has(field.type)) throw new Error(`Invalid custom field definition for ${entity}`);
      if (keys.has(field.key)) throw new Error(`Duplicate custom field key ${field.key} for ${entity}`);
      keys.add(field.key);
      if (field.type === "select" && (!Array.isArray(field.options) || !field.options.length || field.options.some(option => typeof option !== "string"))) throw new Error(`Select field ${field.key} must have string options`);
    }
  }
  return customFields;
}

async function validateEntityCustomData(tenantId, entity, input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Object.assign(new Error("customData must be an object"), { statusCode: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { customFields: true } });
  const definitions = validateDefinitions(tenant?.customFields || {})[entity] || [];
  const allowed = new Set(definitions.map(field => field.key));
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw Object.assign(new Error(`Unknown ${entity} custom field: ${key}`), { statusCode: 400 });
  const result = {};
  for (const field of definitions) {
    const value = input[field.key];
    if (value == null || value === "") {
      if (field.required) throw Object.assign(new Error(`${field.label || field.key} is required`), { statusCode: 400 });
      continue;
    }
    const valid = field.type === "string" ? typeof value === "string"
      : field.type === "number" ? Number.isFinite(Number(value))
      : field.type === "boolean" ? typeof value === "boolean"
      : field.type === "date" ? !Number.isNaN(new Date(value).getTime())
      : field.options.includes(value);
    if (!valid) throw Object.assign(new Error(`${field.label || field.key} has an invalid value`), { statusCode: 400 });
    result[field.key] = value;
  }
  return result;
}

module.exports = { validateDefinitions, validateEntityCustomData };
