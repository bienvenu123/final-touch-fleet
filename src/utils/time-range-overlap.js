const ISO8601_WITH_TIMEZONE = /(?:Z|[+-]\d{2}:\d{2})$/i;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/**
 * Two half-open ranges [startA, endA) and [startB, endB) overlap when they share
 * any instant. Adjacent ranges where one ends exactly when the other starts do
 * NOT overlap (booking B may start when booking A ends).
 */
function rangesOverlap(startA, endA, startB, endB) {
  const aStart = startA instanceof Date ? startA.getTime() : Number(startA);
  const aEnd = endA instanceof Date ? endA.getTime() : Number(endA);
  const bStart = startB instanceof Date ? startB.getTime() : Number(startB);
  const bEnd = endB instanceof Date ? endB.getTime() : Number(endB);

  return aStart < bEnd && bStart < aEnd;
}

function parseUtcIso8601(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw validationError(`${fieldName} must be an ISO-8601 UTC datetime string`);
  }

  const trimmed = value.trim();
  if (!ISO8601_WITH_TIMEZONE.test(trimmed)) {
    throw validationError(
      `${fieldName} must include a timezone offset (use UTC ISO-8601, e.g. 2026-08-12T10:00:00Z)`
    );
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw validationError(`${fieldName} must be a valid ISO-8601 datetime`);
  }

  return parsed;
}

function parseAvailabilityWindow(query = {}) {
  const startAt = parseUtcIso8601(query.start, "start");
  const endAt = parseUtcIso8601(query.end, "end");

  if (endAt.getTime() <= startAt.getTime()) {
    throw validationError("end must be after start");
  }

  return { startAt, endAt };
}

function toUtcIso8601(date) {
  return date.toISOString();
}

module.exports = {
  rangesOverlap,
  parseUtcIso8601,
  parseAvailabilityWindow,
  toUtcIso8601,
};
