-- DropIndex
DROP INDEX "consent_record_userId_purpose_createdAt_idx";

-- AlterTable
ALTER TABLE "consent_record" ADD COLUMN     "seq" BIGSERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "consent_record_userId_purpose_seq_idx" ON "consent_record"("userId", "purpose", "seq");
