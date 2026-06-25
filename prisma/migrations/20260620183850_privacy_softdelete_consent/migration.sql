-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('IMAGE_PROCESSING', 'MARKETING');

-- AlterTable
ALTER TABLE "deliverable" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "consent_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_record_userId_purpose_createdAt_idx" ON "consent_record"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "deliverable_deletedAt_idx" ON "deliverable"("deletedAt");

-- CreateIndex
CREATE INDEX "project_deletedAt_idx" ON "project"("deletedAt");

-- AddForeignKey
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
