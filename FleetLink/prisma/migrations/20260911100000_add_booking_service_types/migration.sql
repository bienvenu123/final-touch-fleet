CREATE TYPE "BookingServiceType" AS ENUM ('SELF_DRIVE', 'CHAUFFEURED_TRANSFER');

ALTER TABLE "Booking"
  ADD COLUMN "serviceType" "BookingServiceType" NOT NULL DEFAULT 'SELF_DRIVE',
  ADD COLUMN "pickupLocation" TEXT,
  ADD COLUMN "guestName" TEXT,
  ADD COLUMN "guestContact" TEXT;
