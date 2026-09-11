const ALLOWED_KINDS = new Set(["CORPORATE", "RENTAL"]);
const ALLOWED_SERVICE_TYPES = new Set(["SELF_DRIVE", "CHAUFFEURED_TRANSFER"]);
const ALLOWED_BOOKING_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
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

function parseBookingServiceType(value) {
  const serviceType = (value || "SELF_DRIVE").toUpperCase();
  if (!ALLOWED_SERVICE_TYPES.has(serviceType)) {
    throw validationError("serviceType must be SELF_DRIVE or CHAUFFEURED_TRANSFER");
  }
  return serviceType;
}

function parseBookingStatus(value) {
  const status = String(value || "").toUpperCase();
  if (!ALLOWED_BOOKING_STATUSES.has(status)) {
    throw validationError("status must be PENDING, APPROVED, REJECTED, or CANCELLED");
  }
  return status;
}

function parseChauffeuredDetails(data = {}) {
  const pickupLocation = typeof data.pickupLocation === "string" ? data.pickupLocation.trim() : "";
  const guestName = typeof data.guestName === "string" ? data.guestName.trim() : "";
  const guestContact = typeof data.guestContact === "string" ? data.guestContact.trim() : "";
  if (!pickupLocation || !guestName || !guestContact) {
    throw validationError("pickupLocation, guestName, and guestContact are required for chauffeured transfers");
  }
  return { pickupLocation, guestName, guestContact };
}

function canTransition(from, to) {
  if (from === "PENDING") {
    return to === "APPROVED" || to === "REJECTED" || to === "CANCELLED";
  }
  return false;
}

module.exports = {
  ALLOWED_KINDS,
  ALLOWED_SERVICE_TYPES,
  ALLOWED_BOOKING_STATUSES,
  TERMINAL_STATUSES,
  parsePassengerCount,
  parseJustification,
  parseComment,
  parseBookingKind,
  parseBookingServiceType,
  parseBookingStatus,
  parseChauffeuredDetails,
  canTransition,
};
