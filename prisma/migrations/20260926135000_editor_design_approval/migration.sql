CREATE TABLE "editor_design_approval" (
  "id" TEXT PRIMARY KEY,
  "stateId" TEXT NOT NULL REFERENCES "editor_document_state"("id") ON DELETE CASCADE,
  "revisionId" TEXT NOT NULL UNIQUE REFERENCES "editor_document_revision"("id") ON DELETE CASCADE,
  "fingerprint" TEXT NOT NULL,
  "assets" JSONB NOT NULL,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "editor_design_approval_stateId_approvedAt_idx"
  ON "editor_design_approval"("stateId", "approvedAt");

CREATE TRIGGER "editor_approval_no_update" BEFORE UPDATE ON "editor_design_approval"
FOR EACH ROW EXECUTE FUNCTION protect_editor_revision();
