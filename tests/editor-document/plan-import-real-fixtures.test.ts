import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { fromPlanImport } from '@/lib/editor-document/adapters/plano2d-import';
import { planDefects } from '@/lib/editor-document/plan-issues';
import { buildEditorEvidence } from '@/server/quality/evidence/editor-evidence';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import type { DetectedWalls } from '@/server/plan/detect-walls-raster';

const fixtures = [
  { name: 'plano-cad-limpio-1', exteriors: 2 },
  { name: 'plano-esquematica-2-flare-decorado', exteriors: 1 },
];

describe('importación al Editor v2 de planos reales extraídos', () => {
  for (const fixture of fixtures) {
    it(`${fixture.name}: conserva huecos y exteriores sin defectos estructurales`, () => {
      const bytes = readFileSync(join(process.cwd(), 'tests/fixtures/plans', `${fixture.name}.raw.json`));
      const { raw, detected } = JSON.parse(bytes.toString()) as { raw: RawSketch; detected: DetectedWalls | null };
      const result = buildPlanImport(raw, {
        includeFurniture: false,
        normalize: detected
          ? { wallsOverride: detected.walls, imageHeightOverWidth: detected.heightOverWidth }
          : {},
      });
      const converted = fromPlanImport(result);
      expect(converted.issues).toEqual([]);
      expect(converted.document).not.toBeNull();
      const document = converted.document!;
      const defects = planDefects(document);
      const evidence = buildEditorEvidence(document);

      expect(result.exteriors).toHaveLength(fixture.exteriors);
      expect(document.walls.filter((wall) => wall.hidden).length).toBeGreaterThan(0);
      // La cantidad exacta no prueba fidelidad: se comprueban puertas y ventanas
      // en coordenadas de origen en plan-import-fidelity.test.ts.
      expect(document.openings.length).toBeGreaterThan(0);
      expect(defects.openingsWithoutWall).toEqual([]);
      expect(defects.openingsOutsideWall).toEqual([]);
      expect(defects.orphanFloorFinishRoomIds).toEqual([]);
      expect(evidence.estanciasDerivables).toBe(true);
      expect(evidence.topologiaValida).toBe(true);
    });
  }
});
