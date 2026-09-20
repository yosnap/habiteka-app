/**
 * Adaptador de importación: muros ocultos para exteriores, mobiliario del
 * catálogo y acabado de suelo exterior sobre la estancia derivada.
 */
import { describe, expect, it } from 'vitest';
import type { PlanImportResult, Plano2dPayload } from '@/lib/contracts';
import { fromPlanImport } from '@/lib/editor-document/adapters/plano2d-import';
import { deriveRooms } from '@/lib/editor-document/rooms';

/** Casa de 6 × 4 m (ejes) con una terraza de 6 × 2 m pegada a la fachada sur (y = 4000). */
function house(): Plano2dPayload {
  const T = 200;
  const walls = [
    { id: 'n', from: { x: 0, y: 0 }, to: { x: 6000, y: 0 }, thicknessMm: T },
    { id: 's', from: { x: 0, y: 4000 }, to: { x: 6000, y: 4000 }, thicknessMm: T },
    { id: 'w', from: { x: 0, y: 0 }, to: { x: 0, y: 4000 }, thicknessMm: T },
    { id: 'e', from: { x: 6000, y: 0 }, to: { x: 6000, y: 4000 }, thicknessMm: T },
  ];
  return {
    schemaVersion: 1,
    zones: [{
      id: 'z0', name: 'Salón', walls, apertures: [], dimensions: [],
      outline: [{ x: 100, y: 100 }, { x: 5900, y: 100 }, { x: 5900, y: 3900 }, { x: 100, y: 3900 }],
    }],
  };
}

function importResult(): PlanImportResult {
  return {
    plano: house(),
    escalaEstimada: false,
    writtenDimensions: [],
    corrections: [],
    exteriors: [{
      id: 'ext0', name: 'Terraza',
      outline: [{ x: 0, y: 4000 }, { x: 6000, y: 4000 }, { x: 6000, y: 6000 }, { x: 0, y: 6000 }],
      hiddenBoundaries: [
        { from: { x: 6000, y: 4000 }, to: { x: 6000, y: 6000 } },
        { from: { x: 6000, y: 6000 }, to: { x: 0, y: 6000 } },
        { from: { x: 0, y: 6000 }, to: { x: 0, y: 4000 } },
      ],
    }],
    furniture: [{
      id: 'f0', catalogId: 'habiteka:furniture:sofa-3', kind: 'sofa-3', label: 'Sofá de tres plazas',
      x: 3000, y: 1000, widthMm: 2300, depthMm: 950, rotation: 0, zoneId: 'z0',
    }],
    warnings: [],
  };
}

describe('fromPlanImport', () => {
  it('convierte muros, añade límites ocultos, mobiliario y acabado exterior', () => {
    const { document, issues } = fromPlanImport(importResult());
    expect(issues).toEqual([]);
    expect(document).not.toBeNull();
    const doc = document!;
    expect(doc.walls.filter((w) => !w.hidden)).toHaveLength(4);
    const hidden = doc.walls.filter((w) => w.hidden);
    expect(hidden).toHaveLength(3);
    expect(hidden.every((w) => w.name === 'Terraza')).toBe(true);
    // Los límites ocultos reutilizan los vértices de la fachada: la terraza cierra recinto.
    const rooms = deriveRooms(doc);
    expect(rooms).toHaveLength(2);
    expect(doc.floorFinishes).toHaveLength(1);
    expect(doc.floorFinishes![0]!.texture).toBe('tile');
    expect(doc.furniture).toHaveLength(1);
    expect(doc.furniture[0]).toMatchObject({ catalogId: 'habiteka:furniture:sofa-3', x: 3000, y: 1000, dimensionalOrigin: 'raster' });
    expect(doc.labels.map((l) => l.text)).toEqual(['Salón', 'Terraza']);
    expect(doc.schemaVersion).toBe(7);
  });

  it('sin exteriores ni mobiliario equivale a la conversión básica', () => {
    const { document } = fromPlanImport({ ...importResult(), exteriors: [], furniture: [] });
    expect(document!.walls).toHaveLength(4);
    expect(document!.furniture).toEqual([]);
    expect(document!.floorFinishes).toBeUndefined();
  });
});
