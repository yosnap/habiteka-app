/** Anclas tomadas de los dos PNG de referencia: comprueban la distribución,
 * no solo que el JSON sea topológicamente válido. Coordenadas de imagen 0–1. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import type { PlanImportResult } from '@/lib/contracts';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import type { DetectedWalls } from '@/server/plan/detect-walls-raster';

function fixture(name: string): PlanImportResult {
  const { raw, detected } = JSON.parse(readFileSync(join(
    process.cwd(), 'tests/fixtures/plans', `${name}.raw.json`,
  ), 'utf8')) as { raw: RawSketch; detected: DetectedWalls };
  // Los PNG de referencia muestran el arco de estas puertas. Las extracciones
  // históricas se guardaron antes de incluir arcVisible en el contrato.
  raw.aberturas = raw.aberturas.map((opening) => opening.tipo === 'puerta'
    ? { ...opening, arcVisible: true } : opening);
  return buildPlanImport(raw, {
    includeFurniture: false,
    normalize: { wallsOverride: detected.walls, imageHeightOverWidth: detected.heightOverWidth },
  });
}

function wallAt(result: PlanImportResult, x: number, y: number, axis: 'h' | 'v'): boolean {
  const frame = result.sourceFrameMm!;
  return result.plano.zones.flatMap((zone) => zone.walls).some((wall) => {
    const a = { x: wall.from.x / frame.width, y: wall.from.y / frame.height };
    const b = { x: wall.to.x / frame.width, y: wall.to.y / frame.height };
    return axis === 'h'
      ? Math.abs(a.y - b.y) < 0.001 && Math.abs(a.y - y) < 0.025 &&
        x >= Math.min(a.x, b.x) - 0.005 && x <= Math.max(a.x, b.x) + 0.005
      : Math.abs(a.x - b.x) < 0.001 && Math.abs(a.x - x) < 0.025 &&
        y >= Math.min(a.y, b.y) - 0.005 && y <= Math.max(a.y, b.y) + 0.005;
  });
}

function openingAt(result: PlanImportResult, kind: 'puerta' | 'ventana', x: number, y: number): boolean {
  const frame = result.sourceFrameMm!;
  const walls = new Map(result.plano.zones.flatMap((zone) => zone.walls).map((wall) => [wall.id, wall]));
  return result.plano.zones.flatMap((zone) => zone.apertures).some((opening) => {
    if (opening.kind !== kind) return false;
    const wall = walls.get(opening.wallId);
    if (!wall) return false;
    const cx = (wall.from.x + (wall.to.x - wall.from.x) * opening.position) / frame.width;
    const cy = (wall.from.y + (wall.to.y - wall.from.y) * opening.position) / frame.height;
    return Math.hypot(cx - x, cy - y) < 0.022;
  });
}

describe('fidelidad espacial al original', () => {
  it('CAD: salón y comedor se comunican; la cocina queda abierta y la fachada sigue en su sitio', () => {
    const result = fixture('plano-cad-limpio-1');
    expect(wallAt(result, 0.74, 0.52, 'v')).toBe(false);
    expect(wallAt(result, 0.84, 0.334, 'h')).toBe(false);
    expect(wallAt(result, 0.06, 0.2, 'v')).toBe(true);
    expect(wallAt(result, 0.967, 0.2, 'v')).toBe(true);
    expect(wallAt(result, 0.18, 0.084, 'h')).toBe(true);
    expect(openingAt(result, 'puerta', 0.289, 0.334)).toBe(true);
    expect(openingAt(result, 'puerta', 0.479, 0.716)).toBe(true);
    expect(openingAt(result, 'ventana', 0.169, 0.084)).toBe(true);
    expect(result.corrections).toEqual([]);
  });

  it('decorado: los dormitorios conservan los tres muros visibles y no invaden el jardín', () => {
    const result = fixture('plano-esquematica-2-flare-decorado');
    expect(wallAt(result, 0.4, 0.24, 'h')).toBe(true);
    expect(wallAt(result, 0.5, 0.35, 'v')).toBe(true);
    expect(wallAt(result, 0.4, 0.47, 'h')).toBe(true);
    expect(wallAt(result, 0.4, 0.04, 'h')).toBe(false);
    expect(openingAt(result, 'puerta', 0.468, 0.464)).toBe(true);
    expect(openingAt(result, 'puerta', 0.815, 0.569)).toBe(true);
    expect(result.corrections).toEqual([]);
  });
});
