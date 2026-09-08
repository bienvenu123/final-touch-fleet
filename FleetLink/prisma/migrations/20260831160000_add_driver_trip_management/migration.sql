-- Driver, trip, and operational vehicle-status support.
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ON_TRIP', 'IN_MAINTENANCE', 'RESERVED', 'OUT_OF_SERVICE');
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "TripStatus" AS ENUM ('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Vehicle"
  ADD COLUMN "year" INTEGER,
  ADD COLUMN "fuelType" TEXT,
  ADD COLUMN "ownershipStatus" TEXT,
  ADD COLUMN "branch" TEXT,
  ADD COLUMN "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE';

ALTER TABLE "Booking" ADD COLUMN "driverId" TEXT;

CREATE TABLE "Driver" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL,
  "cdlClass" TEXT,
  "coiExpiry" TIMESTAMP(3),
  "employmentStatus" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
  "contact" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Trip" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT,
  "reservationId" TEXT,
  "vehicleId" TEXT NOT NULL,
  "driverId" TEXT,
  "status" "TripStatus" NOT NULL DEFAULT 'PLANNED',
  "startOdometer" INTEGER,
  "endOdometer" INTEGER,
  "distanceDriven" INTEGER,
  "fuelStart" DECIMAL(5,2),
  "fuelEnd" DECIMAL(5,2),
  "chargeStart" DECIMAL(5,2),
  "chargeEnd" DECIMAL(5,2),
  "routeData" JSONB,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Driver_tenantId_licenseNumber_key" ON "Driver"("tenantId", "licenseNumber");
CREATE INDEX "Vehicle_tenantId_status_idx" ON "Vehicle"("tenantId", "status");
CREATE INDEX "Driver_tenantId_employmentStatus_idx" ON "Driver"("tenantId", "employmentStatus");
CREATE INDEX "Trip_tenantId_status_idx" ON "Trip"("tenantId", "status");
CREATE INDEX "Trip_vehicleId_status_idx" ON "Trip"("vehicleId", "status");
CREATE INDEX "Trip_driverId_idx" ON "Trip"("driverId");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Driver"
  ADD CONSTRAINT "Driver_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Driver"
  ADD CONSTRAINT "Driver_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "RentalReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
