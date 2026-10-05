ALTER TABLE "Trip"
  ADD COLUMN "fuelCost" DECIMAL(14,2),
  ADD COLUMN "energyCost" DECIMAL(14,2);

ALTER TABLE "Booking"
  ADD COLUMN "purposeCategory" TEXT;
