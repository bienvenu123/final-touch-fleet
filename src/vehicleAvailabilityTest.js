const assert = require("assert");
const { rangesOverlap, parseUtcIso8601, parseAvailabilityWindow } = require("./utils/time-range-overlap");

const hour = (value) => new Date(value);

// --- overlap engine ---
assert.strictEqual(
  rangesOverlap(hour("2026-08-12T10:00:00Z"), hour("2026-08-12T12:00:00Z"), hour("2026-08-12T12:00:00Z"), hour("2026-08-12T14:00:00Z")),
  false,
  "adjacent bookings (A ends when B starts) must not overlap"
);
assert.strictEqual(
  rangesOverlap(hour("2026-08-12T10:00:00Z"), hour("2026-08-12T13:00:00Z"), hour("2026-08-12T12:00:00Z"), hour("2026-08-12T14:00:00Z")),
  true,
  "partial overlap must be detected"
);
assert.strictEqual(
  rangesOverlap(hour("2026-08-12T10:00:00Z"), hour("2026-08-12T12:00:00Z"), hour("2026-08-12T08:00:00Z"), hour("2026-08-12T11:00:00Z")),
  true,
  "enclosing overlap must be detected"
);
assert.strictEqual(
  rangesOverlap(hour("2026-08-12T10:00:00Z"), hour("2026-08-12T12:00:00Z"), hour("2026-08-12T12:00:00Z"), hour("2026-08-12T10:00:00Z")),
  false,
  "exact boundary touch in reverse order must not overlap"
);
assert.strictEqual(
  rangesOverlap(hour("2026-08-12T10:00:00Z"), hour("2026-08-12T12:00:00Z"), hour("2026-08-12T08:00:00Z"), hour("2026-08-12T10:00:00Z")),
  false,
  "adjacent where requested ends when existing starts must not overlap"
);

// --- UTC ISO-8601 parsing ---
assert.deepStrictEqual(parseUtcIso8601("2026-08-12T10:00:00Z", "start").toISOString(), "2026-08-12T10:00:00.000Z");
assert.deepStrictEqual(parseUtcIso8601("2026-08-12T10:00:00+00:00", "start").toISOString(), "2026-08-12T10:00:00.000Z");

let rejected = false;
try {
  parseUtcIso8601("2026-08-12T10:00:00", "start");
} catch (error) {
  rejected = error.statusCode === 400 && /timezone offset/i.test(error.message);
}
assert.strictEqual(rejected, true, "timezone-less datetimes must be rejected");

const window = parseAvailabilityWindow({
  start: "2026-08-12T10:00:00Z",
  end: "2026-08-12T12:00:00Z",
});
assert.strictEqual(window.startAt.toISOString(), "2026-08-12T10:00:00.000Z");
assert.strictEqual(window.endAt.toISOString(), "2026-08-12T12:00:00.000Z");

console.log("Vehicle availability tests passed.");
