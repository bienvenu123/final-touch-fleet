-- Staff booking workflow fields and requester relation.
ALTER TABLE "Booking" ADD COLUMN "requestedById" TEXT;
ALTER TABLE "Booking" ADD COLUMN "justification" TEXT;
ALTER TABLE "Booking" ADD COLUMN "passengerCount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "comment" TEXT;
ALTER TABLE "Booking" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "rejectedAt" TIMESTAMP(3);

ALTER TABLE "Booking" ALTER COLUMN "kind" SET DEFAULT 'CORPORATE';

UPDATE "Booking"
SET
  "requestedById" = (
    SELECT u."id"
    FROM "User" u
    WHERE u."tenantId" = "Booking"."tenantId"
      AND u."role" = 'STAFF'
    ORDER BY u."id"
    LIMIT 1
  ),
  "justification" = COALESCE("justification", 'Legacy seeded booking'),
  "passengerCount" = COALESCE("passengerCount", 1)
WHERE "requestedById" IS NULL;

ALTER TABLE "Booking" ALTER COLUMN "requestedById" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "justification" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "passengerCount" SET NOT NULL;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
