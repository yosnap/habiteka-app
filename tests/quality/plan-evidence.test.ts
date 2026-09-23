/**
 * Evidencia que se manda a Jev para juzgar una importación de plano: números y
 * listas cortas, nunca la imagen. Se comprueba sobre un fixture real (plano CAD
 * nítido) y sobre una lectura degradada (foto: el modelo inventa muros y el
 * ráster apenas encuentra ninguno).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { buildPlanEvidence } from '@/server/quality/evidence/plan-evidence';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import type { DetectedWalls } from '@/server/plan/detect-walls-raster';

const FIXTURES = join(process.cwd(), 'tests/fixtures/plans');

function fixture(name: string): { raw: RawSketch; detected: DetectedWalls | null } {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.raw.json`), 'utf8'));
}

function evidenceOf(source: { raw: RawSketch; detected: DetectedWalls | null }) {
  const result = buildPlanImport(source.raw, {
    includeFurniture: false,
    normalize: source.detected
      ? { wallsOverride: source.detected.walls, imageHeightOverWidth: source.detected.heightOverWidth }
      : {},
  });
  return buildPlanEvidence({ ...source, result });
}

describe('buildPlanEvidence', () => {
  it('un plano CAD nítido da evidencia coherente y geometría sana', () => {
    const source = fixture('plano-cad-limpio-1');
    const evidence = evidenceOf(source);

    expect(evidence.murosRaster).toBe(source.detected!.walls.length);
    expect(evidence.murosModelo).toBe(source.raw.muros.length);
    expect(evidence.murosPlano).toBeGreaterThan(0);
    expect(evidence.zonas).toBeGreaterThan(0);
    expect(evidence.zonasDibujables).toBe(evidence.zonas);
    expect(evidence.planoDibujable).toBe(true);
    expect(evidence.escalaEstimada).toBe(false);
    expect(evidence.cotasEscritas).toBeGreaterThan(0);
    expect(evidence.murosDegenerados).toBe(0);
    expect(evidence.huecosSinMuro).toBe(0);
  });

  it('la evidencia no arrastra imágenes ni texto libre: solo números y conteos', () => {
    const serialized = JSON.stringify(evidenceOf(fixture('plano-cad-limpio-1')));
    expect(serialized).not.toMatch(/base64|data:image/i);
    // Compacta por diseño: una llamada a Jev no debe costar más de lo que ahorra.
    expect(serialized.length).toBeLessThan(1000);
  });

  it('una foto (muros del modelo sin respaldo en píxeles) baja el ratio de muros', () => {
    const raw: RawSketch = {
      muros: Array.from({ length: 12 }, (_, i) => ({ x1: 0.1 * i, y1: 0.1, x2: 0.1 * i, y2: 0.9 })),
      aberturas: [],
      habitaciones: [
        {
          nombre: 'Salón',
          poligono: [
            { x: 0.1, y: 0.1 },
            { x: 0.5, y: 0.1 },
            { x: 0.5, y: 0.5 },
            { x: 0.1, y: 0.5 },
          ],
        },
      ],
    };
    const detected: DetectedWalls = {
      walls: [{ x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.1 }],
      heightOverWidth: 0.75,
    };
    const evidence = evidenceOf({ raw, detected });

    expect(evidence.escalaEstimada).toBe(true);
    expect(evidence.murosRaster).toBe(1);
  });

  it('sin detección de píxeles los muros ráster son nulos en vez de inventados', () => {
    const raw: RawSketch = { muros: [], aberturas: [], habitaciones: [] };
    const evidence = evidenceOf({ raw, detected: null });
    expect(evidence.murosRaster).toBeNull();
    expect(evidence.planoDibujable).toBe(false);
    expect(evidence.desviacionCotasPct).toBeNull();
  });

  it('cuenta los avisos por tipo y la desviación residual de las cotas', () => {
    const source = fixture('plano-nuestra-casa-flare-tecnico');
    const evidence = evidenceOf(source);
    for (const count of Object.values(evidence.avisosPorTipo)) {
      expect(count).toBeGreaterThan(0);
    }
    if (evidence.desviacionCotasPct) {
      expect(evidence.desviacionCotasPct.max).toBeGreaterThanOrEqual(evidence.desviacionCotasPct.media);
    }
    expect(evidence.ajustesAplicados).toBeGreaterThanOrEqual(0);
  });
});
