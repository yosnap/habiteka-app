import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { propertyNorth, propertySun, propertySunPrompt, setPropertyOrientation, siteRotationForNorth, sunDirection, SUN_DEFAULTS } from '@/lib/editor-document/property-orientation';
import { addBuildingLevel, switchBuildingLevel } from '@/lib/editor-document/building-levels';
import { createEditorStore } from '@/canvas/editor-v2/store';
import { sameDesignContent } from '@/lib/editor-document/approved-design';
import { propertyLightFrame } from '@/components/editor-v2/scene/property-solar-lighting';
import type { GeographicSite } from '@/lib/editor-document/geographic-site';
import { renderDesignOptionsSchema } from '@/lib/editor-document/render-design-options';
import { simplePlanPrompt, simpleSectionPrompt } from '@/server/agent/editor-v2/simple-plan-prompt';

const site: GeographicSite = {
  latitude: 40, longitude: -3, groundWidthM: 180, source: 'IGN-PNOA',
  assetKey: 'geographic-sites/project/user/00000000-0000-4000-8000-000000000000.jpg',
  capturedAt: '2026-10-01T10:00:00.000Z', anchor: { x: .5, y: .5 }, planOriginMm: { x: 0, y: 0 },
  rotationDeg: 90, intervention: [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .5, y: .9 }],
  scenario: 'new-build', lighting: 'daylight', confirmed: true,
};

describe('orientación global y sombras solares', () => {
  it('conserva la luz de presentación anterior hasta definir el norte y admite guardar y deshacer la orientación', () => {
    const original = emptyEditorDocument();
    expect(propertyNorth(original)).toBeUndefined();
    expect(propertySun(original, 'daylight')).toBeUndefined();
    expect(propertySunPrompt(original, 'daylight')).toBe('');
    const store = createEditorStore(original);
    store.getState().apply(setPropertyOrientation(original, { northDeg: 90 }));
    const saved = store.getState().document;
    expect(parseEditorDocument(JSON.parse(JSON.stringify(saved))).propertyOrientation).toEqual({ northDeg: 90 });
    expect(sameDesignContent(saved, original)).toBe(false);
    store.getState().undo(); expect(propertyNorth(store.getState().document)).toBeUndefined();
    store.getState().redo(); expect(propertyNorth(store.getState().document)).toBe(90);
    expect(setPropertyOrientation(saved, { northDeg: 450 })).toBe(saved);
  });

  it('rechaza datos no finitos, alturas imposibles y campos desconocidos', () => {
    for (const orientation of [{ northDeg: NaN }, { northDeg: 90, unknown: true },
      { northDeg: 0, sunlight: { daylight: { azimuthDeg: 400, elevationDeg: 50 } } },
      { northDeg: 0, sunlight: { warm: { azimuthDeg: 270, elevationDeg: -1 } } },
      { northDeg: 0, sunlight: { evening: { azimuthDeg: 270, elevationDeg: 10 } } }]) {
      expect(() => parseEditorDocument({ ...emptyEditorDocument(), propertyOrientation: orientation })).toThrow();
    }
  });

  it('gira la fuente en los ejes del inmueble y proyecta la sombra en sentido contrario', () => {
    const south = { azimuthDeg: 180, elevationDeg: 45 };
    const northUp = sunDirection(0, south), northRight = sunDirection(90, south);
    expect(northUp[0]).toBeCloseTo(0); expect(northUp[2]).toBeCloseTo(Math.SQRT1_2);
    expect(northRight[0]).toBeCloseTo(-Math.SQRT1_2); expect(northRight[2]).toBeCloseTo(0);
    // Sombra de un poste de 1 m sobre el suelo: opuesta al sol y de 1 m con elevación de 45°.
    expect(-northUp[2] / northUp[1]).toBeCloseTo(-1);
    expect(-northRight[0] / northRight[1]).toBeCloseTo(1);
    const low = sunDirection(0, { ...south, elevationDeg: 10 });
    expect(Math.abs(low[2] / low[1])).toBeGreaterThan(5);
    for (const azimuthDeg of [0, 90, 180, 270]) {
      const direction = sunDirection(0, { azimuthDeg, elevationDeg: 55 });
      expect(Math.hypot(...direction)).toBeCloseTo(1);
    }
  });

  it('usa el norte de la ortofoto y actualiza su giro sin mover muros ni perder otros ajustes', () => {
    const original = { ...emptyEditorDocument(), geographicSite: site, propertyOrientation: { northDeg: 20 } };
    expect(propertyNorth(original)).toBe(270);
    const changed = setPropertyOrientation(original, { northDeg: 90 });
    expect(changed.geographicSite).toMatchObject({ rotationDeg: -90, confirmed: false, latitude: site.latitude, anchor: site.anchor });
    expect(changed.vertices).toEqual(original.vertices);
    expect(propertyNorth(changed)).toBe(90);
    expect(original.geographicSite.confirmed).toBe(true);
    const movedOnMap = { ...changed, geographicSite: { ...changed.geographicSite!, rotationDeg: -30 } };
    expect(propertyNorth(movedOnMap)).toBe(30);
    expect(siteRotationForNorth(270)).toBe(90);
    const lightChanged = setPropertyOrientation(original, { sunlight: { daylight: { azimuthDeg: 100, elevationDeg: 20 } } });
    expect(lightChanged.geographicSite?.rotationDeg).toBe(90);
    expect(lightChanged.geographicSite?.confirmed).toBe(false);
  });

  it('mantiene una sola orientación para todas las plantas y ajustes distintos por ambiente sin sol nocturno', () => {
    let doc = setPropertyOrientation(emptyEditorDocument(), { northDeg: 35,
      sunlight: { afternoon: { azimuthDeg: 250, elevationDeg: 22 } } });
    doc = addBuildingLevel(doc);
    expect(propertyNorth(doc)).toBe(35);
    expect(doc.levels![0]!.document?.propertyOrientation).toBeUndefined();
    doc = setPropertyOrientation(doc, { northDeg: 115 });
    doc = switchBuildingLevel(doc, doc.levels![0]!.id);
    expect(propertyNorth(doc)).toBe(115);
    expect(propertySun(doc, 'afternoon')).toEqual({ azimuthDeg: 250, elevationDeg: 22 });
    expect(propertySun(doc, 'daylight')).toEqual(SUN_DEFAULTS.daylight);
    expect(propertySun(doc, 'evening')).toBeUndefined();
  });

  it('traslada juntos luz y objetivo en una casa alejada del origen y dimensiona su área de sombras', () => {
    const doc = emptyEditorDocument();
    doc.vertices = [{ id: 'a', x: 100000, y: 200000 }, { id: 'b', x: 180000, y: 250000 }];
    const first = propertyLightFrame(doc);
    const shifted = propertyLightFrame({ ...doc, vertices: doc.vertices.map(vertex => ({ ...vertex, x: vertex.x + 50000, y: vertex.y - 30000 })) });
    expect(first.center).toEqual([140, 0, 225]);
    expect(shifted.center).toEqual([190, 0, 195]);
    expect(first.radius).toBeGreaterThan(40);
    expect(shifted.radius).toBe(first.radius);
  });

  it('lleva la dirección física a cenitales y alzados sin anunciar sol nocturno ni exceder el presupuesto', () => {
    const doc = setPropertyOrientation(emptyEditorDocument(), { northDeg: 90 });
    const options = renderDesignOptionsSchema.parse({ lighting: 'daylight' });
    const prompt = simplePlanPrompt('moderno', options, '', '', { units: 'mm', levels: [] }, [], [], [], undefined, doc);
    expect(prompt).toContain('norte 90°');
    expect(prompt).toContain('llega desde izquierda y proyecta sombras hacia derecha');
    expect(prompt.length).toBeLessThanOrEqual(4800);
    const section = simpleSectionPrompt('front', 'moderno', options, '', '', [], [], [], doc);
    expect(section).toContain('sin girar el sol con la cámara');
    expect(propertySunPrompt(doc, 'evening')).toContain('sin sol ni sombras solares');
  });
});
