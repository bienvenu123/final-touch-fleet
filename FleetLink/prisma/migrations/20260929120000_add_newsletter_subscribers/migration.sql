CREATE TABLE IF NOT EXISTS "NewsletterSubscriber" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterSubscriber_tenantId_email_key"
ON "NewsletterSubscriber"("tenantId", "email");


CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_tenantId_createdAt_idx"
ON "NewsletterSubscriber"("tenantId", "createdAt");
