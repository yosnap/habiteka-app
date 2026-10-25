-- El catálogo de IA (proveedores compatibles, modelos habilitados y claves) pasa del panel de admin a cada
-- organización. Lo que había en el panel se traslada a la organización de cada cuenta admin (la más antigua de sus
-- membresías), que conserva así su configuración. La clave de Jev (typesafe) sigue siendo de la plataforma.
CREATE TEMP TABLE "admin_org" AS
SELECT DISTINCT ON (u."id") m."organizationId" AS "id"
FROM "user" u JOIN "member" m ON m."userId" = u."id"
WHERE u."role" = 'admin'
ORDER BY u."id", m."createdAt" ASC;

-- Proveedores compatibles: una copia por organización admin.
ALTER TABLE "ai_custom_provider" DROP CONSTRAINT "ai_custom_provider_pkey";
ALTER TABLE "ai_custom_provider" ADD COLUMN "organizationId" TEXT;
INSERT INTO "ai_custom_provider" ("organizationId", "id", "label", "baseUrl", "createdAt", "updatedAt")
SELECT a."id", p."id", p."label", p."baseUrl", p."createdAt", p."updatedAt"
FROM "ai_custom_provider" p CROSS JOIN "admin_org" a WHERE p."organizationId" IS NULL;
DELETE FROM "ai_custom_provider" WHERE "organizationId" IS NULL;
ALTER TABLE "ai_custom_provider" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ai_custom_provider" ADD CONSTRAINT "ai_custom_provider_pkey" PRIMARY KEY ("organizationId", "id");
ALTER TABLE "ai_custom_provider" ADD CONSTRAINT "ai_custom_provider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Modelos habilitados: igual, con id nuevo para cada copia.
DROP INDEX "ai_custom_model_providerId_model_key";
ALTER TABLE "ai_custom_model" ADD COLUMN "organizationId" TEXT;
INSERT INTO "ai_custom_model" ("id", "organizationId", "providerId", "model", "label", "actions", "priceUsdPerUnit", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, a."id", m."providerId", m."model", m."label", m."actions", m."priceUsdPerUnit", m."createdAt", m."updatedAt"
FROM "ai_custom_model" m CROSS JOIN "admin_org" a WHERE m."organizationId" IS NULL;
DELETE FROM "ai_custom_model" WHERE "organizationId" IS NULL;
ALTER TABLE "ai_custom_model" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE UNIQUE INDEX "ai_custom_model_organizationId_providerId_model_key" ON "ai_custom_model"("organizationId", "providerId", "model");
ALTER TABLE "ai_custom_model" ADD CONSTRAINT "ai_custom_model_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Claves del panel activas → claves de la organización admin (el cifrado es el mismo); después se retiran del panel.
INSERT INTO "organization_ai_credential" ("organizationId", "provider", "encryptedApiKey", "keyHint", "createdAt", "updatedAt")
SELECT a."id", c."provider", c."encryptedApiKey", c."keyHint", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ai_provider_credential" c CROSS JOIN "admin_org" a
WHERE c."provider" <> 'typesafe' AND c."enabled"
ON CONFLICT ("organizationId", "provider") DO NOTHING;
DELETE FROM "ai_provider_credential" WHERE "provider" <> 'typesafe';

-- Mapeo del panel → elección propia de la organización admin, en los usos que aún no haya personalizado.
INSERT INTO "organization_model_route" ("organizationId", "action", "position", "provider", "model", "updatedAt")
SELECT a."id", r."action", r."position", r."provider", r."model", CURRENT_TIMESTAMP
FROM "ai_model_route" r CROSS JOIN "admin_org" a
WHERE r."enabled" AND NOT EXISTS (
  SELECT 1 FROM "organization_model_route" o WHERE o."organizationId" = a."id" AND o."action" = r."action"
)
ON CONFLICT ("organizationId", "action", "position") DO NOTHING;

DROP TABLE "admin_org";
