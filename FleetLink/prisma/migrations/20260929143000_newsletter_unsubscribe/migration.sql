ALTER TABLE "NewsletterSubscriber"
  ADD COLUMN "unsubscribeToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN "unsubscribedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "NewsletterSubscriber_unsubscribeToken_key"
ON "NewsletterSubscriber"("unsubscribeToken");
