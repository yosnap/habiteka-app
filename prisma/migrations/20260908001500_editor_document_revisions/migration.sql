CREATE TABLE "editor_document_state" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "project"("id") ON DELETE CASCADE,
  "zoneId" TEXT REFERENCES "project_zone"("id") ON DELETE CASCADE,
  "headRevision" INTEGER NOT NULL DEFAULT 0 CHECK ("headRevision" >= 0),
  "writable" BOOLEAN NOT NULL DEFAULT TRUE,
  "legacySnapshot" JSONB NOT NULL,
  "legacyFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "editor_document_state_projectId_idx" ON "editor_document_state"("projectId");
CREATE INDEX "editor_document_state_zoneId_idx" ON "editor_document_state"("zoneId");
CREATE UNIQUE INDEX "editor_document_state_default_key" ON "editor_document_state"("projectId") WHERE "zoneId" IS NULL;
CREATE UNIQUE INDEX "editor_document_state_zone_key" ON "editor_document_state"("projectId", "zoneId") WHERE "zoneId" IS NOT NULL;

CREATE TABLE "editor_document_revision" (
  "id" TEXT PRIMARY KEY,
  "stateId" TEXT NOT NULL REFERENCES "editor_document_state"("id") ON DELETE CASCADE,
  "revision" INTEGER NOT NULL CHECK ("revision" >= 0),
  "document" JSONB NOT NULL,
  "requestKey" TEXT,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "editor_document_revision_stateId_revision_key" ON "editor_document_revision"("stateId", "revision");
CREATE UNIQUE INDEX "editor_document_revision_stateId_requestKey_key" ON "editor_document_revision"("stateId", "requestKey");

CREATE FUNCTION protect_editor_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Editor revisions are immutable'; END;
$$;
CREATE TRIGGER "editor_revision_no_update" BEFORE UPDATE ON "editor_document_revision"
FOR EACH ROW EXECUTE FUNCTION protect_editor_revision();

CREATE FUNCTION protect_editor_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."legacySnapshot" IS DISTINCT FROM OLD."legacySnapshot"
    OR NEW."legacyFingerprint" IS DISTINCT FROM OLD."legacyFingerprint"
    OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
    OR NEW."zoneId" IS DISTINCT FROM OLD."zoneId" THEN
    RAISE EXCEPTION 'Editor source snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "editor_snapshot_no_update" BEFORE UPDATE ON "editor_document_state"
FOR EACH ROW EXECUTE FUNCTION protect_editor_snapshot();
