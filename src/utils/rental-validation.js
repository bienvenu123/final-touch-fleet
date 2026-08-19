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
  parseBoolean,
};
