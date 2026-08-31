const ALLOWED_KINDS = new Set(["CORPORATE", "RENTAL"]);
const TERMINAL_STATUSES = new Set(["APPROVED", "REJECTED", "CANCELLED"]);

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parsePassengerCount(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw validationError("passengerCount must be a positive whole number");
  }
  return parsed;
}

function parseJustification(value) {
  const justification = typeof value === "string" ? value.trim() : "";
  if (!justification) {
    throw validationError("justification is required");
  }
  return justification;
}

function parseComment(value) {
  const comment = typeof value === "string" ? value.trim() : "";
  if (!comment) {
    throw validationError("comment is required");
  }
  return comment;
}

function parseBookingKind(value) {
  const kind = (value || "CORPORATE").toUpperCase();
  if (!ALLOWED_KINDS.has(kind)) {
    throw validationError("kind must be CORPORATE or RENTAL");
  }
  return kind;
}

function canTransition(from, to) {
  if (from === "PENDING") {
    return to === "APPROVED" || to === "REJECTED" || to === "CANCELLED";
  }
  return false;
}

module.exports = {
  ALLOWED_KINDS,
  TERMINAL_STATUSES,
  parsePassengerCount,
  parseJustification,
  parseComment,
  parseBookingKind,
  canTransition,
};
