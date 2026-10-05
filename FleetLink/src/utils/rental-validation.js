const { parseUtcIso8601 } = require("./time-range-overlap");

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parsePositiveDecimal(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw validationError(`${fieldName} must be a non-negative number`);
  }
  return parsed.toFixed(2);
}

function parseReservationWindow(body = {}) {
  const startAt = parseUtcIso8601(body.start, "start");
  const endAt = parseUtcIso8601(body.end, "end");
  if (endAt.getTime() <= startAt.getTime()) {
    throw validationError("end must be after start");
  }
  return { startAt, endAt };
}

function parseRentalAgreement(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "object") {
    return value;
  }
  throw validationError("rentalAgreement must be an object or string");
}

function parseRentalAddOns(value) {
  if (value === undefined || value === null || value === "") return null;
  if (!Array.isArray(value) || value.length > 30) throw validationError("addOns must be a list of at most 30 items");
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw validationError(`addOns[${index}] must be an object`);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name || name.length > 120) throw validationError(`addOns[${index}].name is required and must be at most 120 characters`);
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw validationError(`addOns[${index}].quantity must be a whole number from 1 to 1000`);
    const unitPrice = parsePositiveDecimal(item.unitPrice ?? 0, `addOns[${index}].unitPrice`);
    return { name, quantity, unitPrice };
  });
}

function parseBoolean(value, fieldName) {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "false") return value === "true";
  throw validationError(`${fieldName} must be a boolean`);
}

module.exports = {
  validationError,
  parsePositiveDecimal,
  parseReservationWindow,
  parseRentalAgreement,
  parseRentalAddOns,
  parseBoolean,
};
