-- Hace el estado del asistente por (proyecto, zona) en vez de uno global por proyecto:
-- añade `zoneId` (nullable, FK a project_zone con borrado en cascada) y reemplaza la
-- unicidad simple por proyecto por unicidad por (proyecto, zona) + un único estado por
-- defecto (zoneId IS NULL). Como en SQL NULL != NULL, se usan DOS índices únicos PARCIALES,
-- igual que en canvas_state. Las filas existentes quedan con zoneId NULL (estado por
-- defecto del proyecto), compatible con proyectos monozona.

-- AlterTable: nueva columna de zona (nullable).
ALTER TABLE "agent_state" ADD COLUMN "zoneId" TEXT;

-- DropIndex (la unicidad simple por proyecto).
DROP INDEX "agent_state_projectId_key";

-- CreateIndex (índices de consulta).
CREATE INDEX "agent_state_projectId_idx" ON "agent_state"("projectId");
CREATE INDEX "agent_state_zoneId_idx" ON "agent_state"("zoneId");

-- Un único estado por (proyecto, zona) cuando la zona está definida.
CREATE UNIQUE INDEX "agent_state_project_zone_key"
  ON "agent_state"("projectId", "zoneId")
  WHERE "zoneId" IS NOT NULL;

-- Un único estado por defecto del proyecto (sin zona).
CREATE UNIQUE INDEX "agent_state_project_default_key"
  ON "agent_state"("projectId")
  WHERE "zoneId" IS NULL;

-- FK a la zona (borrado en cascada: al borrar la zona se borra su estado de asistente).
ALTER TABLE "agent_state" ADD CONSTRAINT "agent_state_zoneId_fkey"
  FOREIGN KEY ("zoneId") REFERENCES "project_zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
