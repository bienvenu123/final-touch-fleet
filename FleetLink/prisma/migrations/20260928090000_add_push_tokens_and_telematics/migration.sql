CREATE TABLE "DevicePushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "DevicePushToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleLocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracyM" DECIMAL(10,2),
    "speedKph" DECIMAL(10,2),
    "heading" DECIMAL(6,2),
    "odometer" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DevicePushToken_token_key" ON "DevicePushToken"("token");
CREATE INDEX "DevicePushToken_userId_revokedAt_idx" ON "DevicePushToken"("userId", "revokedAt");
CREATE INDEX "VehicleLocation_tenantId_vehicleId_recordedAt_idx" ON "VehicleLocation"("tenantId", "vehicleId", "recordedAt");
CREATE INDEX "VehicleLocation_vehicleId_recordedAt_idx" ON "VehicleLocation"("vehicleId", "recordedAt");

ALTER TABLE "DevicePushToken" ADD CONSTRAINT "DevicePushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleLocation" ADD CONSTRAINT "VehicleLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleLocation" ADD CONSTRAINT "VehicleLocation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
