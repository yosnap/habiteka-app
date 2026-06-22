-- AlterTable
ALTER TABLE "canvas_state" ADD COLUMN     "zoneId" TEXT;

-- CreateTable
CREATE TABLE "project_zone" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "project_zone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_zone_organizationId_idx" ON "project_zone"("organizationId");

-- CreateIndex
CREATE INDEX "project_zone_projectId_idx" ON "project_zone"("projectId");

-- CreateIndex
CREATE INDEX "project_zone_deletedAt_idx" ON "project_zone"("deletedAt");

-- CreateIndex
CREATE INDEX "canvas_state_zoneId_idx" ON "canvas_state"("zoneId");

-- CreateIndex
CREATE INDEX "deliverable_zoneId_idx" ON "deliverable"("zoneId");

-- AddForeignKey
ALTER TABLE "project_zone" ADD CONSTRAINT "project_zone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_zone" ADD CONSTRAINT "project_zone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_state" ADD CONSTRAINT "canvas_state_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "project_zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable" ADD CONSTRAINT "deliverable_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "project_zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_image" ADD CONSTRAINT "source_image_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "project_zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
