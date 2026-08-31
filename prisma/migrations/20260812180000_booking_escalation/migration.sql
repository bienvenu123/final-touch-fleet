-- Booking escalation configuration and routing metadata.
ALTER TABLE "Tenant" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "backupApproverId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "bookingEscalationThresholdMs" BIGINT NOT NULL DEFAULT 7200000;

ALTER TABLE "Booking" ADD COLUMN "assignedApproverId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "escalatedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "escalationJobId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "escalationScheduledFor" TIMESTAMP(3);

CREATE INDEX "Booking_assignedApproverId_status_idx" ON "Booking"("assignedApproverId", "status");

ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_backupApproverId_fkey"
  FOREIGN KEY ("backupApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_assignedApproverId_fkey"
  FOREIGN KEY ("assignedApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
