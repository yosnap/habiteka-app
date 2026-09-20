-- Telemetría aditiva de costes operativos IA. Deliberadamente sin FKs: también
-- conserva intentos fallidos y referencias ya eliminadas para auditoría.
CREATE TABLE "ai_request_cost" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "projectId" TEXT,
  "refId" TEXT,
  "batchId" TEXT,
  "action" "ModelAction" NOT NULL,
  "operation" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "units" JSONB,
  "costUsd" DECIMAL(14,8),
  "costType" TEXT NOT NULL,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_request_cost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_request_cost_attempt_check" CHECK ("attempt" >= 0),
  CONSTRAINT "ai_request_cost_latency_check" CHECK ("latencyMs" >= 0),
  CONSTRAINT "ai_request_cost_type_check" CHECK ("costType" IN ('confirmed', 'estimated', 'unknown')),
  CONSTRAINT "ai_request_cost_status_check" CHECK ("status" IN ('success', 'error'))
);
CREATE UNIQUE INDEX "ai_request_cost_requestId_attempt_key" ON "ai_request_cost"("requestId", "attempt");
CREATE INDEX "ai_request_cost_createdAt_idx" ON "ai_request_cost"("createdAt");
CREATE INDEX "ai_request_cost_organizationId_createdAt_idx" ON "ai_request_cost"("organizationId", "createdAt");
CREATE INDEX "ai_request_cost_provider_model_status_idx" ON "ai_request_cost"("provider", "model", "status");
CREATE INDEX "ai_request_cost_projectId_createdAt_idx" ON "ai_request_cost"("projectId", "createdAt");
CREATE INDEX "ai_request_cost_refId_createdAt_idx" ON "ai_request_cost"("refId", "createdAt");
