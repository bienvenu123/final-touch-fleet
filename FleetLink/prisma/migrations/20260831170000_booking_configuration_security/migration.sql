-- Booking destination, tenant configuration and encrypted-identifer lookup support.
ALTER TABLE "Booking" ADD COLUMN "destination" TEXT;
ALTER TABLE "Tenant"
  ADD COLUMN "approvalWorkflow" JSONB,
  ADD COLUMN "notificationSettings" JSONB,
  ADD COLUMN "notificationTemplates" JSONB,
  ADD COLUMN "customFields" JSONB,
  ADD COLUMN "roleConfiguration" JSONB,
  ADD COLUMN "integrationSettings" JSONB,
  ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Driver" ADD COLUMN "licenseNumberHash" TEXT;
ALTER TABLE "Customer" ADD COLUMN "driverLicenseHash" TEXT;
CREATE UNIQUE INDEX "Driver_licenseNumberHash_key" ON "Driver"("licenseNumberHash");
CREATE UNIQUE INDEX "Customer_driverLicenseHash_key" ON "Customer"("driverLicenseHash");
CREATE UNIQUE INDEX "Trip_bookingId_key" ON "Trip"("bookingId");
