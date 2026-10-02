/**
 * Banco de FIDELIDAD de la importación de planos dibujados, sin IA ni red:
 * cada fixture `*.raw.json` guarda la extracción cruda (modelo de visión +
 * muros medidos) de una imagen real, y su sidecar `*.expected.json` las
 * medidas escritas en el plano. Se reconstruye el plano con `buildPlanImport`
 * y se informa cada discrepancia. Si las cotas contradicen los muros medidos,
 * preservar la forma de la imagen tiene prioridad: no se afirma que se hayan
 * cumplido medidas incompatibles. Las anclas espaciales se comprueban aparte
 * en `tests/server/plan-import-fidelity.test.ts`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import type { DetectedWalls } from '@/server/plan/detect-walls-raster';
import { buildPlanImport } from '@/server/plan/build-plan-import';

const FIXTURES = join(process.cwd(), 'tests/fixtures/plans');
const REPORTS = join(process.cwd(), 'plans/reports/offline-260916');

interface Expected {
  general?: { anchoM?: number; altoM?: number };
  estancias: Array<{
    nombre: string;
    anchoM?: number;
    altoM?: number;
    exterior?: boolean;
    /** Motivo por el que esta estancia no puede cumplir su cota (contradicción del propio dibujo). */
    cotaIncompatible?: string;
    /** El modelo no leyó la medida escrita: no hay nada que ajustar. */
    cotaNoLeida?: string;
  }>;
  toleranciaRelativa: number;
}

interface RoomCheck {
  nombre: string;
  /** Excluida de la aserción (con el motivo del sidecar). */
  excluida?: string;
  anchoM?: number;
  altoM?: number;
  medidoAnchoM?: number;
  medidoAltoM?: number;
  desvioAncho?: number;
  desvioAlto?: number;
  ok: boolean;
}

const fixtures = readdirSync(FIXTURES)
  .filter((f) => f.endsWith('.raw.json'))
  .map((f) => f.replace('.raw.json', ''))
  .filter((name) => existsSync(join(FIXTURES, `${name}.expected.json`)));

describe.skipIf(fixtures.length === 0)('fidelidad de la importación de planos (offline)', () => {
  for (const name of fixtures) {
    it(`${name}: informa cotas incompatibles sin desplazar los muros medidos`, () => {
      const { raw, detected } = JSON.parse(readFileSync(join(FIXTURES, `${name}.raw.json`), 'utf8')) as {
        raw: RawSketch;
        detected: DetectedWalls | null;
      };
      const expected = JSON.parse(readFileSync(join(FIXTURES, `${name}.expected.json`), 'utf8')) as Expected;
      const result = buildPlanImport(raw, {
        includeFurniture: false,
        normalize: detected
          ? { wallsOverride: detected.walls, imageHeightOverWidth: detected.heightOverWidth }
          : {},
      });

      const tol = expected.toleranciaRelativa;
      const used = new Set<number>();
      const checks: RoomCheck[] = expected.estancias
        .filter((e) => e.exterior !== true && (e.anchoM !== undefined || e.altoM !== undefined))
        .map((e) => {
          const idx = result.plano.zones.findIndex((z, i) => sameName(z.name, e.nombre) && !used.has(i));
          const zone = idx >= 0 ? result.plano.zones[idx] : undefined;
          if (idx >= 0) used.add(idx);
          const merged = result.plano.zones.some((z) =>
            z.name.includes('/') && z.name.split('/').some((part) => sameName(part, e.nombre)));
          const excluida = e.cotaIncompatible ?? e.cotaNoLeida ??
            (merged ? 'Estancia unida a un espacio abierto; la cota individual no define el recinto.' : undefined);
          const check: RoomCheck = { nombre: e.nombre, anchoM: e.anchoM, altoM: e.altoM, ok: false, ...(excluida ? { excluida } : {}) };
          if (!zone || zone.outline.length < 3) return check;
          const xs = zone.outline.map((p) => p.x);
          const ys = zone.outline.map((p) => p.y);
          check.medidoAnchoM = round2((Math.max(...xs) - Math.min(...xs)) / 1000);
          check.medidoAltoM = round2((Math.max(...ys) - Math.min(...ys)) / 1000);
          if (e.anchoM !== undefined) check.desvioAncho = round2(Math.abs(check.medidoAnchoM - e.anchoM) / e.anchoM);
          if (e.altoM !== undefined) check.desvioAlto = round2(Math.abs(check.medidoAltoM - e.altoM) / e.altoM);
          check.ok = (check.desvioAncho ?? 0) <= tol && (check.desvioAlto ?? 0) <= tol;
          return check;
        });

      const passed = checks.filter((c) => c.ok).length;
      const failing = checks.filter((c) => !c.ok && !c.excluida).map((c) => c.nombre);
      const summary = {
        fixture: name,
        tolerancia: tol,
        estancias: checks.length,
        dentroDeTolerancia: passed,
        zonas: result.plano.zones.length,
        muros: result.plano.zones.reduce((acc, z) => acc + z.walls.length, 0),
        avisos: result.warnings.map((w) => w.message),
        detalle: checks,
      };
      mkdirSync(REPORTS, { recursive: true });
      writeFileSync(join(REPORTS, `${name}.fidelity.json`), JSON.stringify(summary, null, 2));
      const lines = checks.map(
        (c) =>
          `${c.ok ? '✓' : c.excluida ? '–' : '✗'} ${c.nombre.padEnd(22)} ancho ${fmt(c.medidoAnchoM)}/${fmt(c.anchoM)} (${pct(c.desvioAncho)})  alto ${fmt(c.medidoAltoM)}/${fmt(c.altoM)} (${pct(c.desvioAlto)})`,
      );
      process.stdout.write(`\n[${name}] ${passed}/${checks.length} estancias dentro de ±${tol * 100} % (– = cota incompatible o no leída)\n${lines.join('\n')}\n`);

      const rasterPreserved = detected !== null && result.warnings.some((w) =>
        w.code === 'ajuste-desplaza-muros' && w.message.includes('Se conservan los muros'));
      if (rasterPreserved) {
        expect(result.corrections).toEqual([]);
        expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'ajuste-desplaza-muros' }));
      } else {
        expect(failing).toEqual([]);
      }
    });
  }
});

/** Los sidecars escriben los nombres a su manera («Salón - Comedor» / «Salón-comedor»). */
// «Baño» del sidecar casa con «Baño 1» del modelo (numeración añadida por el lector).
const sameName = (a: string, b: string) => {
  const x = normalizeName(a);
  const y = normalizeName(b);
  return x === y || x.replace(/\d+$/, '') === y.replace(/\d+$/, '');
};
const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n?: number) => (n === undefined ? '  -  ' : n.toFixed(2));
const pct = (n?: number) => (n === undefined ? ' - ' : `${Math.round(n * 100)} %`);
