-- CreateTable
CREATE TABLE "tos_acceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tos_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cookie_consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analytics" BOOLEAN NOT NULL DEFAULT false,
    "affiliate" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cookie_consent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tos_acceptance_userId_createdAt_idx" ON "tos_acceptance"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "cookie_consent_userId_createdAt_idx" ON "cookie_consent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "tos_acceptance" ADD CONSTRAINT "tos_acceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cookie_consent" ADD CONSTRAINT "cookie_consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
