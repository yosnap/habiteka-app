-- Quita la unicidad simple por proyecto (un plano por proyecto) y la reemplaza por
-- unicidad por (proyecto, zona): un plano por zona, más un único plano por defecto
-- (zoneId IS NULL). Como en SQL NULL != NULL, un UNIQUE(projectId, zoneId) normal
-- dejaría colar varios planos-default; por eso se usan DOS índices únicos PARCIALES.

-- DropIndex (la unicidad simple por proyecto)
DROP INDEX "canvas_state_projectId_key";

-- CreateIndex (índice normal para consultas por proyecto)
CREATE INDEX "canvas_state_projectId_idx" ON "canvas_state"("projectId");

-- Un único plano por (proyecto, zona) cuando la zona está definida.
CREATE UNIQUE INDEX "canvas_state_project_zone_key"
  ON "canvas_state"("projectId", "zoneId")
  WHERE "zoneId" IS NOT NULL;

-- Un único plano por defecto del proyecto (sin zona).
CREATE UNIQUE INDEX "canvas_state_project_default_key"
  ON "canvas_state"("projectId")
  WHERE "zoneId" IS NULL;
