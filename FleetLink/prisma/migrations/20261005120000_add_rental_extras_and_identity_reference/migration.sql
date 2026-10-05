ALTER TABLE "Customer"
  ADD COLUMN "identityVerificationReference" TEXT;

ALTER TABLE "RentalReservation"
  ADD COLUMN "addOns" JSONB;
