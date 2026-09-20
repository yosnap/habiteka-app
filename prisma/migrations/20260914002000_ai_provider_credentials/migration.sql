CREATE TABLE "ai_provider_credential" (
  "provider" TEXT NOT NULL,
  "encryptedApiKey" TEXT NOT NULL,
  "keyHint" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_provider_credential_pkey" PRIMARY KEY ("provider")
);
