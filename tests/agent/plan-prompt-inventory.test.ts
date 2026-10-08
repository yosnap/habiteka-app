/**
 * La cenital nombra exterior, vehículos, sanitarios y muebles clave en frases breves: con el inventario JSON el prompt
 * pasaba de 20 000 caracteres, los generadores KIE lo rechazaban y el respaldo reinventaba la distribución.
 */
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument, type EditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { renderDesignOptionsSchema } from '@/lib/editor-document/render-design-options';
import { exteriorDesignContext } from '@/lib/editor-document/exterior-design-context';
import { criticalFixtureGroups } from '@/lib/editor-document/critical-fixtures';
import { planFurnitureLines } from '@/server/agent/editor-v2/furniture-views';
import { planRasterBounds } from '@/server/agent/editor-v2/rasterize-editor-document';
import { simplePlanPrompt } from '@/server/agent/editor-v2/simple-plan-prompt';
import { exteriorPlanSummary, fixturePlanSummary, planPlacement } from '@/server/agent/editor-v2/plan-prompt-inventory';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';

const item = (id: string, catalogId: string, x: number, y: number, extra: Partial<Furniture> = {}): Furniture => ({
  id, kind: getFurnitureCatalogEntry(catalogId)!.kind, catalogId, x, y, widthMm: 500, depthMm: 500, heightMm: 800, elevationMm: 0, rotation: 0, color: '#808080', dimensionalOrigin: 'physical', ...extra,
});

/** Salón de 8 × 6 m y baño de 3 × 6 m separados, con jardín, arbustos y cuatro vehículos alrededor. */
function house(): EditorDocument {
  let doc = addWallPath(setDesignSpaceKind(emptyEditorDocument(), 'casa'), [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 }], true);
  doc = addWallPath(doc, [{ x: 8200, y: 0 }, { x: 11200, y: 0 }, { x: 11200, y: 6000 }, { x: 8200, y: 6000 }], true);
  const salon = [
    item('cafe', 'habiteka:model:cafetera_espresso_inox', 500, 500, { widthMm: 300, depthMm: 300 }),
    item('fridge', 'habiteka:model:frigorifico_combi_blanco_203', 1000, 500, { widthMm: 600, depthMm: 650 }),
    item('lamp', 'habiteka:furniture:lampara-mesa', 2000, 500, { elevationMm: 550 }),
    item('tv', 'habiteka:furniture:televisor', 2600, 500, { elevationMm: 500, widthMm: 1200, depthMm: 250 }),
    ...Array.from({ length: 6 }, (_, index) => item(`chair${index}`, 'habiteka:asset:silla_comedor_blanca', 3000 + index * 500, 3000, { widthMm: 430, depthMm: 540 })),
    item('table', 'habiteka:furniture:mesa-comedor:grande', 4000, 3500, { widthMm: 2000, depthMm: 1000 }),
    item('sofa', 'habiteka:furniture:sofa-2', 1000, 4000, { widthMm: 1600, depthMm: 900 }),
    item('chimenea', 'habiteka:asset:chimenea', 200, 2500, { widthMm: 720, depthMm: 380 }),
    item('tvunit', 'habiteka:furniture:mueble-tv', 2000, 200, { widthMm: 1600, depthMm: 400 }),
    item('planter', 'habiteka:outdoor:arbusto', 6500, 1000, { widthMm: 1000, depthMm: 900, elevationMm: 200 }),
  ];
  const bath = [
    ...[0, 1, 2].map((index) => item(`wc${index}`, 'habiteka:furniture:inodoro', 8500 + index * 600, 500, { widthMm: 400, depthMm: 700 })),
    item('basin', 'habiteka:furniture:lavabo', 9000, 3000, { widthMm: 600, depthMm: 450 }),
  ];
  const outside = [
    item('van', 'habiteka:outdoor:coche:furgoneta', 14000, 1000, { widthMm: 2000, depthMm: 5200 }),
    item('car', 'habiteka:outdoor:coche', 17000, 1000, { widthMm: 1750, depthMm: 4000 }),
    item('sedan1', 'habiteka:outdoor:coche:turismo-3d', 14000, 9000, { widthMm: 1800, depthMm: 4600 }),
    item('sedan2', 'habiteka:outdoor:coche:turismo-3d', 17000, 9000, { widthMm: 1800, depthMm: 4600 }),
    ...Array.from({ length: 9 }, (_, index) => item(`bush${index}`, 'habiteka:outdoor:arbusto', index * 1200, 12000, { widthMm: 1000, depthMm: 900 })),
  ];
  return { ...doc,
    labels: [{ id: 'l1', x: 4000, y: 3000, text: 'Salón' }, { id: 'l2', x: 9700, y: 3000, text: 'Baño' }],
    furniture: [...salon, ...bath, ...outside],
    terrainSurfaces: [{ id: 'grass', name: 'Terreno exterior', x: -1000, y: -1000, widthMm: 21000, depthMm: 15000, rotation: 0,
      color: '#ffffff', texture: 'outdoor:grass-lawn-pbr', tileSizeMm: 1400 }] } as EditorDocument;
}

function prompt(freedom: 'strict' | 'controlled' | 'free', additions: string[] = []) {
  const doc = house();
  const spatial = { units: 'mm' as const, levels: [{ id: 'l', name: 'Planta', openings: [], rooms: [
    { id: 'R1', name: 'Salón', anchor: { x: 4000, y: 3000 }, boundary: [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 }] },
    { id: 'R2', name: 'Baño', anchor: { x: 9700, y: 3000 }, boundary: [{ x: 8200, y: 0 }, { x: 11200, y: 0 }, { x: 11200, y: 6000 }, { x: 8200, y: 6000 }] },
  ] }] };
  const options = renderDesignOptionsSchema.parse({ freedom, additions, views: ['top'] });
  return simplePlanPrompt('moderno', options, '', '', spatial, planFurnitureLines(doc, spatial.levels[0]!.rooms),
    exteriorDesignContext(doc), criticalFixtureGroups(doc), planRasterBounds(doc));
}

describe('prompt corto de la cenital', () => {
  it('cabe en el límite de Flux y no envía identificadores ni coordenadas', () => {
    const text = prompt('free');
    expect(text.length).toBeLessThan(5000);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-|"footprint"|sourceId/);
  });

  it('nombra los vehículos, la vegetación y los sanitarios por estancia', () => {
    const text = prompt('free');
    expect(text).toContain('vehículos: furgoneta');
    expect(text).toMatch(/turismo moderno ×2/);
    expect(text).toMatch(/arbusto ×10/);
    expect(text).toContain('Césped verde PBR (todo el terreno)');
    expect(text).toMatch(/Baño \([^)]*\): 3 inodoros, 1 lavabo/);
  });

  it('prioriza chimenea, mueble de TV y sillas frente a la cafetera y omite lo apoyado sobre otros muebles', () => {
    const line = planFurnitureLines(house(), [{ name: 'Salón', boundary: [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 }] }])[0]!;
    expect(line).toMatch(/^Salón: sofá/);
    for (const name of ['chimenea', 'mueble de televisión', 'silla de comedor de madera blanca (6)']) expect(line).toContain(name);
    expect(line.indexOf('chimenea')).toBeLessThan(line.indexOf('cafetera'));
    expect(line).not.toContain('televisor con soporte');
    expect(line).not.toContain('lámpara de mesa');
    // Un arbusto sobre una jardinera elevada no es un detalle apoyado en otro mueble.
    expect(line).toContain('arbusto');
  });

  it('distingue Estricto, Controlado y Libre', () => {
    expect(prompt('strict')).toContain('Conserva solo el mobiliario dibujado');
    expect(prompt('controlled', ['plants', 'lights'])).toContain('solo puedes añadir: plantas, lámparas e iluminación decorativa.');
    expect(prompt('controlled')).toContain('No añadas objetos al mobiliario dibujado.');
    expect(prompt('free')).toContain('Completa la decoración según el uso de cada estancia');
  });

  it('nunca supera el presupuesto en una casa grande con muchas estancias y preferencias largas', () => {
    const rooms = Array.from({ length: 14 }, (_, index) => ({ id: `R${index}`, name: `Dormitorio de invitados ${index + 1}`,
      anchor: { x: (index % 4) * 4000, y: Math.floor(index / 4) * 4000 } }));
    const furniture = rooms.map((room) => `${room.name}: ${Array.from({ length: 10 }, (_, item) => `mueble de catálogo muy descriptivo ${item} (2)`).join(', ')}`);
    const doc = house();
    const text = simplePlanPrompt('moderno', renderDesignOptionsSchema.parse({ freedom: 'free', views: ['top'] }), 'x'.repeat(300), 'y'.repeat(300),
      { units: 'mm', levels: [{ id: 'l', name: 'Planta', openings: [], rooms }] }, furniture, exteriorDesignContext(doc), criticalFixtureGroups(doc), planRasterBounds(doc));
    expect(text.length).toBeLessThanOrEqual(4800);
    expect(text).toContain('y otros dibujados en el plano');
    expect(text).toContain('vehículos: furgoneta');
  });

  it('en perspectiva nombra sin posiciones del plano y con las políticas completas de esas vistas', () => {
    const doc = house();
    const text = [...exteriorPlanSummary(exteriorDesignContext(doc)), ...fixturePlanSummary(criticalFixtureGroups(doc))].join('\n');
    expect(text).toContain('EXTERIOR EXISTENTE OBLIGATORIO');
    expect(text).toContain('SANITARIOS Y COCCIÓN');
    expect(text).toMatch(/turismo moderno ×2[,;.]/);
    expect(text).toMatch(/Baño: 3 inodoros, 1 lavabo/);
    expect(text).not.toMatch(/\((arriba|abajo|izquierda|derecha|centro)/);
  });

  it('sitúa cada punto en el tercio de la imagen que ocupa', () => {
    const box = { x: 0, y: 0, width: 900, height: 900 };
    expect(planPlacement({ x: 100, y: 100 }, box)).toBe('arriba izquierda');
    expect(planPlacement({ x: 450, y: 450 }, box)).toBe('centro');
    expect(planPlacement({ x: 450, y: 800 }, box)).toBe('abajo');
  });
});
