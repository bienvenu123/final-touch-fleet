const assert = require("assert");
const _validation = require("./services/trip.validation");

assert.strictEqual(_validation.nonNegativeInteger("12", "odometer"), 12);
assert.throws(() => _validation.nonNegativeInteger("12.5", "odometer"), /whole number/);
assert.strictEqual(_validation.level("50", "fuel"), 50);
assert.throws(() => _validation.level(101, "fuel"), /between 0 and 100/);
assert.deepStrictEqual(_validation.checklist({ exterior: true, interior: true, safetyEquipment: true }, "checklist"), { exterior: true, interior: true, safetyEquipment: true });
assert.throws(() => _validation.checklist({ exterior: true }, "checklist"), /interior/);
console.log("Trip validation tests passed.");
