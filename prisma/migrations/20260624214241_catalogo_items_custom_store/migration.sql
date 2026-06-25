-- CreateTable
CREATE TABLE "catalog_item" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'custom',
    "category" TEXT NOT NULL,
    "family" TEXT,
    "thumbnailKey" TEXT,
    "modelKey" TEXT,
    "widthM" DOUBLE PRECISION NOT NULL,
    "depthM" DOUBLE PRECISION NOT NULL,
    "heightM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storeSlug" TEXT,
    "storeProductId" TEXT,
    "storePrice" DECIMAL(10,2),
    "storeProductUrl" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "catalog_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_item_organizationId_idx" ON "catalog_item"("organizationId");

-- CreateIndex
CREATE INDEX "catalog_item_kind_idx" ON "catalog_item"("kind");

-- CreateIndex
CREATE INDEX "catalog_item_category_idx" ON "catalog_item"("category");

-- CreateIndex
CREATE INDEX "catalog_item_deletedAt_idx" ON "catalog_item"("deletedAt");

-- AddForeignKey
ALTER TABLE "catalog_item" ADD CONSTRAINT "catalog_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
