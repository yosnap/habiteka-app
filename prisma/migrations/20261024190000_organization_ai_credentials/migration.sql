-- Cada organización guarda sus propias claves de proveedores de IA, cifradas como las del panel.
CREATE TABLE "organization_ai_credential" (
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_ai_credential_pkey" PRIMARY KEY ("organizationId","provider")
);

ALTER TABLE "organization_ai_credential" ADD CONSTRAINT "organization_ai_credential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
