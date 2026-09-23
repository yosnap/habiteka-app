-- Evaluaciones de calidad de Jev por punto de control. Aditiva y sin FKs:
-- conserva también los intentos en los que no se pudo evaluar, para auditar la
-- política de fallo y medir coste frente a resultado.
CREATE TABLE "ai_quality_evaluation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "projectId" TEXT,
  "checkpoint" TEXT NOT NULL,
  "refId" TEXT,
  "score" INTEGER,
  "decision" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "answers" JSONB NOT NULL,
  "reasons" JSONB NOT NULL,
  "evidenceHash" TEXT NOT NULL,
  "jevModel" TEXT,
  "inputTokens" INTEGER,
  "costUsd" DECIMAL(14,8) NOT NULL,
  "failOpen" BOOLEAN NOT NULL,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_quality_evaluation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_quality_evaluation_decision_check" CHECK ("decision" IN ('proceed', 'confirm', 'block')),
  CONSTRAINT "ai_quality_evaluation_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100)),
  CONSTRAINT "ai_quality_evaluation_tokens_check" CHECK ("inputTokens" IS NULL OR "inputTokens" >= 0)
);
CREATE INDEX "ai_quality_evaluation_organizationId_createdAt_idx" ON "ai_quality_evaluation"("organizationId", "createdAt");
CREATE INDEX "ai_quality_evaluation_checkpoint_createdAt_idx" ON "ai_quality_evaluation"("checkpoint", "createdAt");
CREATE INDEX "ai_quality_evaluation_refId_idx" ON "ai_quality_evaluation"("refId");
