-- Rutas ordenadas de ejecución: cada respaldo guarda también su proveedor.
CREATE TABLE "ai_model_route" (
    "id" TEXT NOT NULL,
    "action" "ModelAction" NOT NULL,
    "position" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_route_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_model_route_action_position_key" ON "ai_model_route"("action", "position");
CREATE INDEX "ai_model_route_action_enabled_idx" ON "ai_model_route"("action", "enabled");

-- Migra configuraciones anteriores. Los fallbacks legacy pertenecían al mismo
-- proveedor que el primario, por lo que su semántica se conserva exactamente.
INSERT INTO "ai_model_route" ("id", "action", "position", "provider", "model", "enabled", "createdAt", "updatedAt")
SELECT 'legacy-primary-' || md5("action"::text || "primaryModel"), "action", 0,
       COALESCE("provider", 'openrouter'), "primaryModel", "enabled", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "model_config"
ON CONFLICT ("action", "position") DO NOTHING;

INSERT INTO "ai_model_route" ("id", "action", "position", "provider", "model", "enabled", "createdAt", "updatedAt")
SELECT 'legacy-backup-' || md5(mc."action"::text || fallback."model" || fallback."ordinality"::text),
       mc."action", fallback."ordinality"::integer, COALESCE(mc."provider", 'openrouter'),
       fallback."model", mc."enabled", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "model_config" mc
CROSS JOIN LATERAL unnest(mc."fallbacks") WITH ORDINALITY AS fallback("model", "ordinality")
ON CONFLICT ("action", "position") DO NOTHING;
