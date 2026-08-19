const assert = require("assert");
const {
  canTransition,
  parseJustification,
  parseComment,
  parsePassengerCount,
  TERMINAL_STATUSES,
} = require("./utils/booking-validation");

// --- state machine ---
assert.strictEqual(canTransition("PENDING", "APPROVED"), true);
assert.strictEqual(canTransition("PENDING", "REJECTED"), true);
assert.strictEqual(canTransition("PENDING", "CANCELLED"), true);
assert.strictEqual(canTransition("APPROVED", "REJECTED"), false);
assert.strictEqual(canTransition("REJECTED", "APPROVED"), false);
assert.strictEqual(TERMINAL_STATUSES.has("APPROVED"), true);

// --- validation ---
assert.strictEqual(parseJustification("  Team offsite travel  "), "Team offsite travel");
assert.strictEqual(parsePassengerCount(3), 3);

let rejectedJustification = false;
try {
  parseJustification("   ");
} catch (error) {
  rejectedJustification = error.statusCode === 400 && /justification/i.test(error.message);
}
assert.strictEqual(rejectedJustification, true, "empty justification must be rejected");

let rejectedPassengers = false;
try {
  parsePassengerCount(0);
} catch (error) {
  rejectedPassengers = error.statusCode === 400 && /passengerCount/i.test(error.message);
}
assert.strictEqual(rejectedPassengers, true, "invalid passengerCount must be rejected");

let rejectedComment = false;
try {
  parseComment("");
} catch (error) {
  rejectedComment = error.statusCode === 400 && /comment/i.test(error.message);
}
assert.strictEqual(rejectedComment, true, "empty rejection comment must be rejected");
assert.strictEqual(parseComment(" Vehicle unavailable for requested window "), "Vehicle unavailable for requested window");

const {
  thresholdMsFromTenant,
  computeEscalationScheduledFor,
  requiresImmediateDepartureAlert,
  resolveEscalationTarget,
} = require("./utils/booking-escalation");

assert.strictEqual(thresholdMsFromTenant({ bookingEscalationThresholdMs: 7200000 }), 7200000);
assert.strictEqual(thresholdMsFromTenant({ bookingEscalationThresholdMs: null }), 7200000);

const now = new Date();
const withinThreshold = new Date(now.getTime() + 90 * 60 * 1000);
const beyondThreshold = new Date(now.getTime() + 3 * 60 * 60 * 1000);
assert.strictEqual(requiresImmediateDepartureAlert(now, withinThreshold, 2 * 60 * 60 * 1000), true);
assert.strictEqual(requiresImmediateDepartureAlert(now, beyondThreshold, 2 * 60 * 60 * 1000), false);

assert.strictEqual(computeEscalationScheduledFor(now, 2 * 60 * 60 * 1000).getTime(), now.getTime() + 2 * 60 * 60 * 1000);

assert.strictEqual(
  resolveEscalationTarget({
    backupApprover: { id: "1", email: "backup@example.com", isActive: true },
    owner: { id: "2", email: "owner@example.com", isActive: true },
    superAdmins: [{ id: "3", email: "admin@example.com", isActive: true }],
  }).id,
  "1"
);
assert.strictEqual(
  resolveEscalationTarget({
    backupApprover: null,
    owner: { id: "2", email: "owner@example.com", isActive: true },
    superAdmins: [{ id: "3", email: "admin@example.com", isActive: true }],
  }).id,
  "2"
);
assert.strictEqual(
  resolveEscalationTarget({
    backupApprover: null,
    owner: null,
    superAdmins: [{ id: "3", email: "admin@example.com", isActive: true }],
  }).id,
  "3"
);
assert.strictEqual(
  resolveEscalationTarget({
    backupApprover: { id: "1", email: "backup@example.com", isActive: false },
    owner: null,
    superAdmins: [],
  }),
  null
);

console.log("Booking workflow tests passed.");
