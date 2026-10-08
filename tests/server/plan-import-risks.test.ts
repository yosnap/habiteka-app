import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { OrgContext } from '@/server/auth/org-context';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import type { DetectedWalls } from '@/server/plan/detect-walls-raster';

vi.mock('server-only', () => ({}));

import { buildPlanImport } from '@/server/plan/build-plan-import';
import { evaluatePlanQuality } from '@/server/plan/import-plan-from-image';

const FIXTURES = join(process.cwd(), 'tests/fixtures/plans');
const context = { organizationId: 'isolated-fixture', userId: 'fixture-user', role: 'owner' } as OrgContext;

function fixture(name: string) {
  const { raw, detected } = JSON.parse(readFileSync(join(FIXTURES, `${name}.raw.json`), 'utf8')) as {
    raw: RawSketch; detected: DetectedWalls | null;
  };
  const result = buildPlanImport(raw, {
    includeFurniture: false,
    normalize: detected ? { wallsOverride: detected.walls, imageHeightOverWidth: detected.heightOverWidth } : {},
  });
  return { raw, detected, result };
}

describe('riesgos visibles en planos reales', () => {
  it('fusiona el salón y comedor abiertos sin inventar un tabique y conserva el bloqueo por cotas', async () => {
    const input = fixture('plano-cad-limpio-1');
    expect(input.result.warnings).toContainEqual(expect.objectContaining({
      code: 'estancias-fusionadas', message: expect.stringMatching(/Comedor.*Salón/),
    }));
    expect(input.result.plano.zones.some((zone) => zone.name === 'Comedor / Salón')).toBe(true);
    const quality = await evaluatePlanQuality(context, 'fixture-cad', undefined, input);
    expect(quality.decision).toBe('block');
    expect(input.result.warnings.some((warning) =>
      warning.code === 'cotas-generales-discordantes' || warning.code === 'ajuste-desplaza-muros')).toBe(true);
    expect(quality.reasons.join(' ')).toMatch(/dimensiones globales.*perímetro leído|muros de la imagen/);
    expect(quality.reasons.join(' ')).toContain('no cotas verificadas por el usuario');
  });

  it('señala muros desplazados por el ajuste de cotas en un plano decorado', async () => {
    const input = fixture('plano-esquematica-2-flare-decorado');
    expect(input.result.warnings).toContainEqual(expect.objectContaining({
      code: 'ajuste-desplaza-muros', message: expect.stringMatching(/respecto al dibujo/),
    }));
    expect((await evaluatePlanQuality(context, 'fixture-decorado', undefined, input)).decision).toBe('block');
  });
});
