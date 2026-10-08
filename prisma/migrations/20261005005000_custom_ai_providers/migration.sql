-- CreateTable
CREATE TABLE "ai_custom_provider" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_custom_provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_custom_model" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "actions" "ModelAction"[],
    "priceUsdPerUnit" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_custom_model_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_custom_model_providerId_model_key" ON "ai_custom_model"("providerId", "model");

-- AddForeignKey
ALTER TABLE "ai_custom_model" ADD CONSTRAINT "ai_custom_model_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_custom_provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
