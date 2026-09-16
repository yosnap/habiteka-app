/**
 * Banco de pruebas OFFLINE de la extracción (cero llamadas a IA): toma una
 * imagen real de plano (EXTRACT_INPUT), corre la detección de píxeles + la
 * normalización completa y escribe el SVG rasterizado para inspección visual.
 * Permite afinar la extracción sin gastar créditos de proveedor.
 *
 * Uso: EXTRACT_INPUT=/ruta/plano.png EXTRACT_OUT=/ruta/salida.png vitest run …
 */
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { detectWallsFromImage } from '@/server/plan/detect-walls-raster';
import { normalizeSketch, DEFAULT_NORMALIZE_OPTIONS } from '@/server/ai/sketch/normalize-geometry';
import {
  bridgeCollinearGaps,
  collapseDoubleWalls,
  dropIsolatedShortWalls,
  mergeCollinear,
  snapEndpointsToWalls,
} from '@/server/ai/sketch/wall-cleanup';
import type { SketchWall } from '@/server/ai/sketch/sketch-types';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';

const INPUT = process.env.EXTRACT_INPUT;
const OUT = process.env.EXTRACT_OUT;

describe.skipIf(!INPUT || !OUT)('extracción offline sobre imagen real', () => {
  it('detecta muros y normaliza sin IA; escribe el resultado para inspección', async () => {
    const image = readFileSync(INPUT!);
    const minRunRatio = process.env.EXTRACT_MIN_RUN ? Number(process.env.EXTRACT_MIN_RUN) : undefined;
    const detected = await detectWallsFromImage(image, minRunRatio !== undefined ? { minRunRatio } : {});
     
    console.log(`[offline] muros detectados: ${detected.walls.length}, aspecto: ${detected.heightOverWidth.toFixed(3)}`);

    const plano = normalizeSketch(
      { anchoMetros: 10, muros: [], aberturas: [], habitaciones: [] },
      { wallsOverride: detected.walls, imageHeightOverWidth: detected.heightOverWidth },
    );
    const zones = plano.zones.map((z) => z.name).join(', ');
    const apertures = plano.zones.flatMap((z) => z.apertures);
    // Clases de grosor resultantes (fachada/tabique): cuántos muros por grosor.
    const byThickness = new Map<number, number>();
    for (const w of plano.zones.flatMap((z) => z.walls)) {
      byThickness.set(w.thicknessMm, (byThickness.get(w.thicknessMm) ?? 0) + 1);
    }
    const thicknessSummary = [...byThickness.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([mm, n]) => `${mm}mm×${n}`)
      .join(' ');

    // Resumen legible junto al PNG (la config de vitest silencia la consola).
    writeFileSync(
      OUT!.replace('.png', '.summary.json'),
      JSON.stringify(
        {
          murosDetectados: detected.walls.length,
          aspecto: Number(detected.heightOverWidth.toFixed(3)),
          murosFinales: plano.zones.reduce((acc, z) => acc + z.walls.length, 0),
          zonas: zones,
          aberturas: apertures.length,
          grosores: thicknessSummary,
        },
        null,
        2,
      ),
    );

    const svg = planoToSvg(plano, { pxPerMeter: 100, showDimensions: false, showAreas: false });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    writeFileSync(OUT!, png);

    // Vista RAW: lo que el escáner ve ANTES de la limpieza, para distinguir
    // fallos de detección de fallos de normalización.
    const rawPlano = {
      schemaVersion: 1,
      zones: [
        {
          id: 'z0',
          name: 'raw',
          outline: [],
          walls: detected.walls.map((w, i) => ({
            id: `w${i}`,
            from: { x: Math.round(w.x1 * 10000), y: Math.round(w.y1 * 10000 * detected.heightOverWidth) },
            to: { x: Math.round(w.x2 * 10000), y: Math.round(w.y2 * 10000 * detected.heightOverWidth) },
            thicknessMm: 80,
          })),
          apertures: [],
          dimensions: [],
        },
      ],
    };
    const rawSvg = planoToSvg(rawPlano, { pxPerMeter: 100, showDimensions: false, showLabels: false });
    writeFileSync(OUT!.replace('.png', '-raw.png'), await sharp(Buffer.from(rawSvg)).png().toBuffer());

    // Trazado por ETAPAS de la limpieza: dónde muere cada muro.
    const o = DEFAULT_NORMALIZE_OPTIONS;
    const stages: Array<[string, SketchWall[]]> = [];
    let ws = detected.walls.filter(
      (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) >= o.minWallLength,
    );
    stages.push(['1-filter', ws]);
    // (alignToGrid es interno; se aproxima el trazado con las etapas exportadas)
    ws = collapseDoubleWalls(ws, o.snapDistance * 1.5, o.angleToleranceDeg);
    stages.push(['2-collapse', ws]);
    ws = mergeCollinear(ws, o.angleToleranceDeg, o.snapDistance);
    stages.push(['3-merge', ws]);
    ws = bridgeCollinearGaps(ws, o.angleToleranceDeg, 0.24, o.snapDistance).walls;
    stages.push(['4-bridge', ws]);
    ws = snapEndpointsToWalls(ws, o.snapDistance * 1.5);
    stages.push(['5-snapT', ws]);
    ws = dropIsolatedShortWalls(ws, o.minDiagonalLength * 2, o.snapDistance);
    stages.push(['6-dropIso', ws]);

    for (const [name, stageWalls] of stages) {
      const stagePlano = {
        schemaVersion: 1,
        zones: [
          {
            id: 'z0',
            name,
            outline: [],
            walls: stageWalls.map((w, i) => ({
              id: `w${i}`,
              from: {
                x: Math.round(w.x1 * 10000),
                y: Math.round(w.y1 * 10000 * detected.heightOverWidth),
              },
              to: {
                x: Math.round(w.x2 * 10000),
                y: Math.round(w.y2 * 10000 * detected.heightOverWidth),
              },
              thicknessMm: 80,
            })),
            apertures: [],
            dimensions: [],
          },
        ],
      };
      const stageSvg = planoToSvg(stagePlano, {
        pxPerMeter: 60,
        showDimensions: false,
        showLabels: false,
      });
      writeFileSync(
        OUT!.replace('.png', `-${name}.png`),
        await sharp(Buffer.from(stageSvg)).png().toBuffer(),
      );
    }
    expect(detected.walls.length).toBeGreaterThan(0);
  });
});
