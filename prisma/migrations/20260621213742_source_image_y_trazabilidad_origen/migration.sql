-- CreateEnum
CREATE TYPE "SourceImageRole" AS ENUM ('PRIMARY', 'DETAIL');

-- AlterTable
ALTER TABLE "deliverable" ADD COLUMN     "sourceImageId" TEXT,
ADD COLUMN     "zoneId" TEXT;

-- CreateTable
CREATE TABLE "source_image" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "zoneId" TEXT,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "role" "SourceImageRole" NOT NULL DEFAULT 'PRIMARY',
    "faceBlurred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "source_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_image_organizationId_idx" ON "source_image"("organizationId");

-- CreateIndex
CREATE INDEX "source_image_projectId_idx" ON "source_image"("projectId");

-- CreateIndex
CREATE INDEX "source_image_zoneId_idx" ON "source_image"("zoneId");

-- CreateIndex
CREATE INDEX "source_image_deletedAt_idx" ON "source_image"("deletedAt");

-- CreateIndex
CREATE INDEX "deliverable_sourceImageId_idx" ON "deliverable"("sourceImageId");

-- AddForeignKey
ALTER TABLE "deliverable" ADD CONSTRAINT "deliverable_sourceImageId_fkey" FOREIGN KEY ("sourceImageId") REFERENCES "source_image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_image" ADD CONSTRAINT "source_image_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_image" ADD CONSTRAINT "source_image_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
