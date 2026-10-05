ALTER TABLE "Vehicle"
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "Vehicle_tenantId_externalSource_externalId_key"
  ON "Vehicle"("tenantId", "externalSource", "externalId");

ALTER TABLE "Department"
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "Department_tenantId_externalSource_externalId_key"
  ON "Department"("tenantId", "externalSource", "externalId");

ALTER TABLE "User"
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "User_tenantId_externalSource_externalId_key"
  ON "User"("tenantId", "externalSource", "externalId");

ALTER TABLE "VehicleLocation"
  ADD COLUMN "externalEventId" TEXT;
CREATE UNIQUE INDEX "VehicleLocation_tenantId_source_externalEventId_key"
  ON "VehicleLocation"("tenantId", "source", "externalEventId");

CREATE TABLE "IntegrationApiKey" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "IntegrationApiKey_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IntegrationApiKey_tenantId_revokedAt_idx"
  ON "IntegrationApiKey"("tenantId", "revokedAt");
ALTER TABLE "IntegrationApiKey"
  ADD CONSTRAINT "IntegrationApiKey_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IntegrationSyncRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "syncType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "received" INTEGER NOT NULL DEFAULT 0,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "IntegrationSyncRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IntegrationSyncRun_tenantId_startedAt_idx"
  ON "IntegrationSyncRun"("tenantId", "startedAt");
ALTER TABLE "IntegrationSyncRun"
  ADD CONSTRAINT "IntegrationSyncRun_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
