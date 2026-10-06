import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { exteriorRenderDocument } from '../helpers/exterior-render-document';
import { criticalFixtureGroups } from '@/lib/editor-document/critical-fixtures';
import { kitchenRunDefaults } from '@/lib/editor-document/kitchen-run-types';
import { vehicleType } from '@/lib/editor-document/vehicle-type';
import { exteriorDesignContext } from '@/lib/editor-document/exterior-design-context';
import { validateRenderFidelity } from '@/server/agent/editor-v2/render-fidelity-verdict';
import { RENDER_FIDELITY_CRITERIA } from '@/lib/editor-document/render-fidelity';
import { rasterizeEditorDocument } from '@/server/agent/editor-v2/rasterize-editor-document';
import { renderSpatialRule, type RenderSpatialContext } from '@/server/agent/editor-v2/render-spatial-context';

const document = () => {
  const doc = exteriorRenderDocument(); doc.schemaVersion = 11;
  doc.furniture = [
    { id: 'wc', kind: 'asset-inodoro', catalogId: 'habiteka:asset:inodoro', x: 3200, y: 3200, widthMm: 400, depthMm: 700 },
    { id: 'sink', kind: 'asset-lavabo', catalogId: 'habiteka:asset:lavabo', x: 4200, y: 3200, widthMm: 600, depthMm: 450 },
    { id: 'shower', kind: 'asset-ducha', catalogId: 'habiteka:asset:ducha', x: 5000, y: 4200, widthMm: 900, depthMm: 900 },
  ].map(item => ({ ...item, heightMm: 900, elevationMm: 0, color: '#ffffff', rotation: 0, dimensionalOrigin: 'physical' }));
  const run = kitchenRunDefaults({ id: 'run', x: 3000, y: 6500, widthMm: 3000, rotation: 0 });
  run.kitchen.slots = [{ id: 'hob', kind: 'vitroceramica', positionMm: 1500, widthMm: 600, color: '#20282b' }];
  doc.kitchenRuns = [run]; return doc;
};
const groups = criticalFixtureGroups(document());
const context: RenderSpatialContext = { units: 'mm', levels: [{ id: 'ground', name: 'Planta', rooms: [], openings: [], fixtureGroups: groups }] };
const verdict = () => ({ accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true,
  redesignApplied: true, roomUsesPreserved: true, doorsPhysicallyCoherent: true, circulationPreserved: true, photorealistic: true,
  criteria: Object.keys(RENDER_FIDELITY_CRITERIA).map(id => ({ id, status: 'pass', observation: 'Referencia contrastada' })),
  roomChecks: [], openingChecks: [], openAreaChecks: [], exteriorChecks: [], violations: [],
  constructionCheck: { status: 'pass', observation: 'Sin construcciones añadidas' },
  fixtureChecks: groups.map(group => ({ id: group.id, status: 'pass', identityAndPlacement: 'preserved',
    referenceCounts: { ...group.counts }, observedCounts: { ...group.counts }, observation: 'Cantidades visibles contrastadas' })),
});
const audit = (candidate: unknown) => validateRenderFidelity(candidate, false, context, undefined, false, [], [], { fullPlan: true });

describe('identidad de sanitarios, vitrocerámica y vehículos', () => {
  it('cuenta inodoro, lavabo y ducha distintos; incluye la placa integrada en la cocina', () => {
    expect(groups[0]?.counts).toMatchObject({ toilet: 1, washbasin: 1, shower: 1, bath: 0 });
    expect(groups[1]?.counts.cooktop).toBe(1); expect(groups[1]?.items[0]?.center).toEqual({ x: 4500, y: 6800 });
    expect(audit(verdict()).status).toBe('passed');
  });
  it('la revisión recibe dónde mirar pero no las cantidades, que el código contrasta después', () => {
    // Con las cantidades delante, la revisión las copiaba y aprobaba dos inodoros donde el plano tiene uno.
    const bathroom = groups.find(group => group.counts.toilet === 1)!;
    const review = renderSpatialRule(context, true, true);
    expect(review).toContain(JSON.stringify(bathroom.id));
    expect(review).toContain('searchAreaMm');
    expect(review).not.toContain('"counts"');
    expect(review).not.toContain('"kind":"toilet"');
    expect(renderSpatialRule(context)).toContain('"counts"');
  });
  it('rechaza tres inodoros, placa borrada o recuento omitido aunque el resumen apruebe', () => {
    const repeated = verdict(); repeated.fixtureChecks[0]!.observedCounts.toilet = 3;
    expect(() => audit(repeated)).toThrow(/inodoro: se esperaban 1/);
    const missing = verdict(); missing.fixtureChecks[1]!.observedCounts.cooktop = 0;
    expect(() => audit(missing)).toThrow(/placa de cocción/);
    const incomplete = verdict(); incomplete.fixtureChecks.pop();
    expect(() => audit(incomplete)).toThrow(/no comprobó los sanitarios/);
  });
  it('no fuerza cantidades del plano sobre una cenital aceptada ni impide sustituir bañera por ducha con permiso', () => {
    const accepted = verdict(); accepted.fixtureChecks[0]!.referenceCounts.washbasin = 2;
    accepted.fixtureChecks[0]!.observedCounts.washbasin = 2;
    expect(validateRenderFidelity(accepted, false, context, undefined, false, [], [], { acceptedDesign: true }).status).toBe('passed');
    const changed = verdict(); changed.fixtureChecks[0]!.observedCounts.shower = 0; changed.fixtureChecks[0]!.observedCounts.bath = 1;
    expect(validateRenderFidelity(changed, false, context, undefined, false, [], [], { fullPlan: true, redesignFixed: true }).status).toBe('passed');
    expect(() => audit(changed)).toThrow(/bañera/);
  });
  it('pinta cerámica blanca y el vidrio negro con cuatro zonas de cocción en lugar de cajas marrones', async () => {
    const { base64 } = await rasterizeEditorDocument(document());
    const { data, info } = await sharp(Buffer.from(base64, 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (Math.floor((y+800)/11600*info.height)*info.width + Math.floor((x+800)/11600*info.width))*3;
      return [...data.subarray(offset, offset+3)];
    };
    expect(pixel(3400, 3250)).toEqual([243, 245, 244]);
    expect(pixel(4500, 6800)).toEqual([32, 40, 43]);
    let rings = 0; for (let i = 0; i < data.length; i += 3)
      if (Math.abs(data[i]!-190) < 8 && Math.abs(data[i+1]!-198) < 8 && Math.abs(data[i+2]!-202) < 8) rings++;
    expect(rings).toBeGreaterThan(30);
  });
  it('identifica SUV, furgoneta y compacto por catálogo aunque cambien nombre y dimensiones', () => {
    const car = exteriorRenderDocument().furniture[0]!;
    expect(vehicleType({ ...car, catalogId: 'habiteka:outdoor:coche:suv' })).toBe('suv');
    expect(vehicleType({ ...car, catalogId: 'habiteka:model:furgoneta_exterior' })).toBe('van');
    expect(vehicleType({ ...car, catalogId: undefined })).toBe('unspecified');
    const doc = exteriorRenderDocument(); doc.furniture[0] = { ...car, catalogId: 'habiteka:outdoor:coche:suv', name: 'Compacto', widthMm: 1700 };
    const exterior = exteriorDesignContext(doc), candidate = { ...verdict(), fixtureChecks: [],
      exteriorChecks: exterior.map(item => ({ id: item.id, status: 'pass', observedCategory: item.category,
        observedVehicleType: 'vehicleType' in item ? item.vehicleType : 'not-applicable',
        identityAndGeometry: 'preserved', finish: 'preserved', observation: 'Objeto en su sitio' })) };
    const vehicleContext: RenderSpatialContext = { units: 'mm', levels: [{ id: 'ground', name: 'Planta', rooms: [], openings: [], exterior }] };
    expect(validateRenderFidelity(candidate, false, vehicleContext).status).toBe('passed');
    candidate.exteriorChecks.find(item => item.id === car.id)!.observedVehicleType = 'compact';
    expect(() => validateRenderFidelity(candidate, false, vehicleContext)).toThrow(/debe ser suv/);
  });
});
