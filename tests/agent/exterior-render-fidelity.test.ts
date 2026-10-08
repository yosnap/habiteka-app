import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { exteriorRenderDocument } from '../helpers/exterior-render-document';
import { exteriorDesignContext } from '@/lib/editor-document/exterior-design-context';
import { rasterizeEditorDocument } from '@/server/agent/editor-v2/rasterize-editor-document';
import { RENDER_FIDELITY_SCHEMA, validateRenderFidelity } from '@/server/agent/editor-v2/render-fidelity-verdict';
import { RENDER_FIDELITY_CRITERIA } from '@/lib/editor-document/render-fidelity';
import type { RenderSpatialContext } from '@/server/agent/editor-v2/render-spatial-context';
import { renderSpatialContext } from '@/server/agent/editor-v2/render-spatial-context';
import { prepareRenderImageRequest } from '@/server/agent/editor-v2/prepare-render-image-request';
import { selectedViewImagePrompt } from '@/server/agent/editor-v2/selected-view-image-prompt';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { assertRenderFidelity } from '@/server/agent/editor-v2/render-fidelity-audit';
import type { ChatVisionAdapter } from '@/lib/contracts';

const view: RenderView = { preset: 'top', position: [0, 20, 0], quaternion: [0, 0, 0, 1],
  focus: [0, 0, 0], fov: 45, aspect: 1, allLevels: false, cutaway: true, ceilingView: 'hidden' };
const doc = exteriorRenderDocument();
const exterior = exteriorDesignContext(doc, 'L1-E-');
const context: RenderSpatialContext = { units: 'mm', levels: [{ id: 'ground', name: 'Planta', rooms: [], openings: [], exterior }] };
function verdict() {
  return { accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, redesignApplied: true,
    roomUsesPreserved: true, doorsPhysicallyCoherent: true, circulationPreserved: true, photorealistic: true,
    criteria: Object.keys(RENDER_FIDELITY_CRITERIA).map(id => ({ id, status: 'pass', observation: 'Referencia comparada' })),
    roomChecks: [], openingChecks: [], openAreaChecks: [], violations: [],
    constructionCheck: { status: 'pass', observation: 'No hay nuevas construcciones' },
    exteriorChecks: exterior.map(item => ({ id: item.id, status: 'pass', observedCategory: item.category as string,
      observedVehicleType: 'vehicleType' in item ? item.vehicleType ?? 'not-applicable' : 'not-applicable',
      identityAndGeometry: 'preserved', finish: 'preserved', observation: `${item.name} visible en su ubicación` })),
  };
}

describe('conservación de césped, cerco y vehículos', () => {
  it('conserva huella del terreno aunque se gire la textura y detalla las puertas del cerco', () => {
    expect(exterior.find(item => item.sourceId === 'lawn')?.footprint).toEqual([
      { x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 }]);
    const hedge = exterior.find(item => item.category === 'boundary');
    expect(hedge && 'construction' in hedge && hedge.construction.gates[0]?.openAngleDeg).toBe(90);
    expect(exterior.filter(item => item.category === 'vehicle')).toHaveLength(2);
    expect(renderSpatialContext(doc, view, defaultRenderDesignOptions()).levels[0]?.exterior).toEqual(exterior);
  });

  it('rasteriza césped texturado, recinto interior blanco, cerco y cristales de coche sin recortar el jardín', async () => {
    const png = await rasterizeEditorDocument(doc);
    const { data, info } = await sharp(Buffer.from(png.base64, 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(1280); expect(info.height).toBe(1280);
    const pixel = (x: number, y: number) => {
      const offset = (Math.floor((y + 800) / 11600 * info.height) * info.width
        + Math.floor((x + 800) / 11600 * info.width)) * 3;
      return [...data.subarray(offset, offset + 3)];
    };
    const grass = pixel(9000, 9000);
    expect(grass[1]).toBeGreaterThan(grass[0]!); // Césped incluso lejos de muros y objetos.
    expect(pixel(4500, 4500)).toEqual([251, 250, 247]); // No pintar el césped dentro de la casa.
    expect(pixel(2200, 1150)).toEqual([53, 107, 56]); // Tramo real de seto.
    expect(pixel(7900, 4400)).toEqual([52, 73, 81]); // Parabrisas; antes era todo marrón.
    expect(pixel(7900, 5100)).toEqual([197, 200, 204]); // Techo pintado.
    expect(pixel(5000, 1100)).not.toEqual([53, 107, 56]); // Hueco de la puerta abierto.
  });

  it('la solicitud cenital describe el exterior aunque no esté dentro de una estancia', async () => {
    const raster = await rasterizeEditorDocument(doc);
    const image = { ...raster, width: 1280, height: 1280, mimeType: 'image/png' as const };
    const { request } = await prepareRenderImageRequest({ document: doc, view, style: 'moderno',
      options: defaultRenderDesignOptions(), objective: '', instruction: '', reference: image, plan: image,
      spatial: { context, image } });
    expect(request.referenceImages).toHaveLength(1);
    expect(request.prompt).toContain('Césped verde PBR');
    // La cenital nombra el exterior en frases breves; el inventario con identificadores queda para la auditoría.
    expect(request.prompt).toContain('el césped sigue siendo césped');
    expect(request.prompt).toMatch(/1 puerta con su apertura/);
    expect(request.prompt).toMatch(/vehículos: [^;]*×2|vehículos: [^;]*, [^;]*/);
    expect(request.prompt).not.toContain('"id":"car1"');
    // El arco de giro salía como un tablón curvo entre los marcos.
    expect(request.prompt).toMatch(/tabla rígida y recta[^.]*sin arcos ni piezas curvas/);
  });

  it('las vistas con captura nombran el exterior sin inventario JSON y solo dentro de las zonas elegidas', () => {
    const iso: RenderView = { ...view, preset: 'isometric', position: [20, 15, 20], cutaway: false };
    const all = defaultRenderDesignOptions();
    const prompt = selectedViewImagePrompt(doc, iso, 'moderno', all, '', '', false, false, false, renderSpatialContext(doc, iso, all));
    expect(prompt).toContain('EXTERIOR EXISTENTE OBLIGATORIO');
    expect(prompt).toContain('Exterior del proyecto, si aparece en esta cámara');
    expect(prompt).toContain('Césped verde PBR');
    expect(prompt).toMatch(/1 puerta con su apertura/);
    // El inventario con identificadores y contornos solo lo recibe la auditoría.
    expect(prompt).not.toContain('L1-E-');
    expect(prompt).not.toContain('"footprint"');
    // En perspectiva no se dan posiciones del plano: arriba o izquierda no son los de la imagen.
    expect(prompt).not.toMatch(/Exterior del proyecto[^\n]*\((arriba|abajo|izquierda|derecha|centro)/);
    // Sin ortofoto la isométrica no inventa calles ni casas vecinas alrededor de la parcela (en Estricto ya lo impide su propia regla).
    const controlled = { ...all, freedom: 'controlled' as const };
    expect(selectedViewImagePrompt(doc, iso, 'moderno', controlled, '', '', false, false, false, renderSpatialContext(doc, iso, controlled))).toContain('SIN ORTOFOTO');
    expect(selectedViewImagePrompt(doc, iso, 'moderno', controlled, '', '', false, false, true, renderSpatialContext(doc, iso, controlled))).not.toContain('SIN ORTOFOTO');
    const zone = { ...all, placement: 'selected' as const,
      regions: [{ id: 'garaje', name: 'Garaje', polygon: [{ x: 6500, y: 2500 }, { x: 9500, y: 2500 }, { x: 9500, y: 8000 }, { x: 6500, y: 8000 }] }] };
    const zonePrompt = selectedViewImagePrompt(doc, iso, 'moderno', zone, '', '', true, false, false, renderSpatialContext(doc, iso, zone));
    expect(zonePrompt).toMatch(/vehículos: coche/);
    expect(zonePrompt).not.toContain('cercos:');
    expect(zonePrompt).not.toContain('Césped verde PBR');
  });

  it('incluye suelos de jardín y no exige mostrar capas totalmente cubiertas', async () => {
    const document = exteriorRenderDocument(), room = deriveRooms(document)[0]!;
    document.floorFinishes = [{ roomId: room.id, texture: 'outdoor:grass-lawn-pbr', color: '#ffffff',
      tileSizeMm: 1400, rotation: 0 }];
    document.terrainSurfaces!.push({ ...document.terrainSurfaces![0]!, id: 'covered', x: 4000, y: 4000,
      widthMm: 1000, depthMm: 1000, texture: 'outdoor:soil' });
    const inventory = exteriorDesignContext(document);
    expect(inventory.some(item => item.sourceId === `floor:${room.id}` && item.category === 'surface')).toBe(true);
    const covered = inventory.find(item => item.sourceId === 'covered');
    expect(covered?.category === 'surface' && covered.visibleInPlan).toBe(false);
    const png = await rasterizeEditorDocument(document);
    const { data, info } = await sharp(Buffer.from(png.base64, 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (Math.floor(5300 / 11600 * info.height) * info.width + Math.floor(5300 / 11600 * info.width)) * 3;
    expect(data[pixel + 1]).toBeGreaterThan(data[pixel]!); // El suelo exterior tapa el parche de tierra.
  });

  it('el auditor recibe el inventario y rechaza césped visible declarado oculto en una cenital', async () => {
    const png = await rasterizeEditorDocument(doc), image = { ...png, mimeType: 'image/png' };
    const hidden = verdict(); Object.assign(hidden.exteriorChecks[0]!, { status: 'not-visible',
      observedCategory: 'not-visible', identityAndGeometry: 'not-visible', finish: 'not-visible' });
    const chat = vi.fn().mockResolvedValue({ text: '', structured: hidden });
    await expect(assertRenderFidelity({ chat } as unknown as ChatVisionAdapter, image, image, view,
      undefined, 2, false, undefined, false, false, { context, image }, { reference: 'plan' }))
      .rejects.toThrow(/debe verse/);
    const sent = JSON.stringify(chat.mock.calls[0]![0].messages[0].content[0]);
    expect(sent).toContain('exteriorChecks'); expect(sent).toContain('L1-E-lawn');
    expect(sent).toContain('bloque de madera');
  });

  it('exige comprobar cada elemento una vez y conserva evidencias en el informe', () => {
    expect(RENDER_FIDELITY_SCHEMA.required).toContain('exteriorChecks');
    const incomplete = verdict(); incomplete.exteriorChecks.pop();
    expect(() => validateRenderFidelity(incomplete, false, context)).toThrow(/todo el terreno/);
    const duplicate = verdict(); duplicate.exteriorChecks[3] = duplicate.exteriorChecks[2]!;
    expect(() => validateRenderFidelity(duplicate, false, context)).toThrow(/todo el terreno/);
    const report = validateRenderFidelity(verdict(), false, context);
    expect(report.status).toBe('passed'); expect(report.exteriorChecks).toHaveLength(4);
  });

  it.each(['material', 'vehicle', 'boundary', 'position'] as const)('rechaza %s cambiado aunque el resumen diga pass', change => {
    const candidate = verdict();
    if (change === 'material') candidate.exteriorChecks[0]!.finish = 'changed';
    if (change === 'vehicle') candidate.exteriorChecks[2]!.observedCategory = 'other';
    if (change === 'boundary') candidate.exteriorChecks[1]!.identityAndGeometry = 'changed';
    if (change === 'position') candidate.exteriorChecks[3]!.identityAndGeometry = 'uncertain';
    expect(() => validateRenderFidelity(candidate, false, context)).toThrow(/objetos reconocibles sustituidos/);
  });

  it('no permite ocultar un cerco desaparecido en una cenital completa, sí lo que la cámara lateral no ve', () => {
    const hidden = verdict(); Object.assign(hidden.exteriorChecks[1]!, { status: 'not-visible',
      observedCategory: 'not-visible', identityAndGeometry: 'not-visible', finish: 'not-visible' });
    expect(validateRenderFidelity(hidden, false, context).status).toBe('passed');
    expect(() => validateRenderFidelity(hidden, false, context, undefined, false, [], [exterior[1]!.id]))
      .toThrow(/debe verse/);
  });

  it('acepta el exterior que la maqueta de sección no muestra aunque la revisión repita su categoría', () => {
    // La trasera se descartaba por «visibilidad contradictoria» con todo el exterior declarado no visible.
    const hidden = verdict(); Object.assign(hidden.exteriorChecks[0]!, { status: 'not-visible',
      observedCategory: 'surface', identityAndGeometry: 'not-visible', finish: 'not-visible' });
    expect(validateRenderFidelity(hidden, false, context).status).toBe('passed');
    // Si dice no visible pero describe su identidad, sigue siendo una contradicción.
    const contradictory = verdict(); Object.assign(contradictory.exteriorChecks[0]!, { status: 'not-visible',
      observedCategory: 'surface', identityAndGeometry: 'preserved', finish: 'preserved' });
    expect(() => validateRenderFidelity(contradictory, false, context)).toThrow(/objetos reconocibles sustituidos|cámara o geometría/);
  });
});
