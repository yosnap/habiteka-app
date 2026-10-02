ALTER TABLE "editor_design_approval"
  ADD COLUMN "lightingPreset" TEXT NOT NULL DEFAULT 'daylight'
  CHECK ("lightingPreset" IN ('daylight', 'warm', 'evening'));
