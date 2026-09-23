-- Caché de evaluaciones: reutilizar el veredicto de una evidencia idéntica
-- exige buscar por organización, punto de control y hash de la evidencia.
CREATE INDEX IF NOT EXISTS "ai_quality_evaluation_organizationId_checkpoint_evidenceHash_idx"
  ON "ai_quality_evaluation" ("organizationId", "checkpoint", "evidenceHash");
