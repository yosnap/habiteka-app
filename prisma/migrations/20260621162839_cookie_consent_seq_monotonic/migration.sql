-- DropIndex
DROP INDEX "cookie_consent_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "cookie_consent" ADD COLUMN     "seq" BIGSERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "cookie_consent_userId_seq_idx" ON "cookie_consent"("userId", "seq");
