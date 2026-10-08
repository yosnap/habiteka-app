import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { PerspectiveCamera } from 'three';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';
import { prepareRenderImageRequest } from '@/server/agent/editor-v2/prepare-render-image-request';
import { fitRenderReferenceAspect } from '@/server/agent/editor-v2/render-reference-frame';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';

const image = async (width = 160, height = 90, color = '#eee') => ({
  width, height, mimeType: 'image/png' as const,
  base64: (await sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer()).toString('base64'),
});
const document = setDesignSpaceKind(emptyEditorDocument(), 'casa');
const spatial = { image: await image(100, 100, '#333'), context: { units: 'mm' as const, levels: [{
  id: 'ground', name: 'Planta', rooms: [{ id: 'R1', name: 'Comedor', anchor: { x: 500, y: 500 } }], openings: [],
}] } };
const reference = await image();
function viewFor(preset: RenderView['preset']): RenderView {
  const camera = new PerspectiveCamera(45, 16 / 9);
  camera.position.set(.5, 2, 6); camera.lookAt(.5, .5, .5);
  return { preset, position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
    focus: [.5, .5, .5], fov: 45, aspect: 16 / 9, allLevels: false, cutaway: true, ceilingView: 'hidden' };
}
const base = { document, style: 'moderno' as const, options: defaultRenderDesignOptions(),
  objective: '', instruction: '', reference, spatial };

describe('referencias de generación por cámara', () => {
  it('conserva el cristal azul de la guía arquitectónica y adjunta el detalle aceptado sin sustituir la cenital', async () => {
    const anchor = await image(240, 180, '#a07850'), detail = await image(60, 60, '#9cb');
    const { request, reference: capture } = await prepareRenderImageRequest({ ...base, reference: await image(160, 90, '#65b8d4'),
      view: { ...viewFor('custom'), architectureOnly: true, roomId: 'room-a' }, styleAnchor: anchor, acceptedDesign: true,
      describeInterior: async () => ({ brief: ['Fuente cuadrada'], detail }) });
    expect(request.referenceImages).toEqual([capture, anchor, detail]);
    expect(request.prompt).toContain('ARQUITECTURA SIN MOBILIARIO');
    expect(request.prompt).toContain('CRISTAL REAL');
  });
  it('el interior conserva la referencia completa sin inventar un recorte ni imponer los acabados del editor', async () => {
    const anchor = await image(240, 180, '#a07850');
    const { request, styleAnchor } = await prepareRenderImageRequest({ ...base,
      view: { ...viewFor('custom'), roomId: 'room-a', roomName: 'Salón', cutaway: false, ceilingView: 'solid' },
      options: { ...base.options, interiorRoomIds: ['room-a'] }, styleAnchor: anchor, acceptedDesign: true,
      describeInterior: async () => ({ brief: ['Sillas: respaldo continuo y tapizado beige'] }) });
    expect(styleAnchor).toEqual(anchor);
    expect(request.referenceImages).toContainEqual(anchor);
    expect(request.referenceImages).toHaveLength(2);
    expect(request.prompt).not.toContain('COPIA ANOTADA');
    expect(request.prompt).toContain('CENITAL ACEPTADA SIN GIRAR');
    expect(request.prompt).not.toContain('su borde inferior es la fachada');
    expect(request.prompt).not.toContain('DISEÑO FIJADO');
    expect(request.prompt).not.toContain('FIJOS PROTEGIDOS');
    expect(request.prompt).not.toContain('Puedes sustituir muebles');
    expect(request.prompt).toContain('respaldo continuo y tapizado beige');
  });
  it.each(['front', 'back', 'left', 'right', 'isometric', 'drone', 'exterior', 'custom'] as const)(
    '%s mantiene la cámara sin adjuntar una segunda perspectiva cenital', async preset => {
      const { request, reference: source } = await prepareRenderImageRequest({ ...base, view: viewFor(preset) });
      expect(request.referenceImages).toHaveLength(2);
      expect(request.referenceImages![0]).toEqual(source);
      expect(request.referenceImages).not.toContainEqual(spatial.image);
      expect(request.prompt).toContain('COPIA ANOTADA');
      expect(request.aspectRatio).toBe('16:9');
      expect(request.prompt).toContain('Comedor');
      expect(request.prompt).toContain('No se adjunta una imagen cenital');
      expect(request.prompt).not.toContain('la última referencia es un plano');
      expect(request.prompt).toContain('NO autorizan a destaparla');
    },
  );

  it('genera la cenital desde el plano 2D con un prompt corto y una sola referencia', async () => {
    const plan = await image(300, 200, '#fbfaf7');
    const { request, reference: source } = await prepareRenderImageRequest({ ...base, view: viewFor('top'), plan,
      instruction: 'suelos de roble claro' });
    expect(request.referenceImages).toEqual([source]);
    expect(request.aspectRatio).toBe('3:2');
    expect(request.prompt).toContain('vista cenital a partir del plano');
    expect(request.prompt).toContain('puertas con su lado y su giro');
    expect(request.prompt).toContain('Comedor (centro)');
    expect(request.prompt).toContain('suelos de roble claro');
    expect(request.prompt).not.toContain('EDICIÓN DE LA IMAGEN 1');
    expect(request.prompt.length).toBeLessThan(1200);
  });

  it('genera el alzado desde la sección 2D con la cenital aceptada y personas', async () => {
    const section = await image(400, 150, '#e8e3d9');
    const prepared = await prepareRenderImageRequest({ ...base, view: viewFor('front'),
      options: { ...defaultRenderDesignOptions(), people: true }, styleAnchor: await image(200, 100, '#a07850'), acceptedDesign: true,
      section: { image: section, rooms: [{ name: 'Comedor', boundary: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] }],
        describe: async (_top, names) => ({ lines: names.map((name) => `${name}: mesa al fondo`), pieces: names.map(() => []) }) } });
    const { request, reference: source } = prepared;
    expect(request.referenceImages).toHaveLength(2);
    expect(request.referenceImages![0]).toEqual(source);
    expect('sectionRooms' in prepared && prepared.sectionRooms).toEqual([{ id: 'R1', name: 'Comedor' }]);
    expect(request.prompt).toContain('maqueta abierta vista desde el frente');
    expect(request.prompt).toContain('Estancias de izquierda a derecha: Comedor');
    expect(request.prompt).toContain('leído del diseño aceptado de la imagen 2: Comedor: mesa al fondo.');
    expect(request.prompt).not.toContain('se ve de espaldas');
    expect(request.prompt).toContain('nunca una vista aérea');
    expect(request.prompt).toContain('sin techo ni tejado');
    expect(request.prompt).not.toContain('suelo, techo');
    expect(request.prompt).toContain('personas haciendo vida cotidiana');
    expect(request.prompt).not.toContain('EDICIÓN DE LA IMAGEN 1');
  });
  it('lee el mobiliario aceptado aunque el plano contenga otros muebles', async () => {
    const document = { ...base.document, furniture: [{ id: 'old-bed', kind: 'cama', x: 200, y: 200,
      widthMm: 400, depthMm: 600, rotation: 0, dimensionalOrigin: 'physical' as const }] };
    const read = vi.fn(async () => ({ lines: ['Comedor: mesa del diseño aceptado, sin cama'], pieces: [[]] }));
    const withFurniture = vi.fn();
    const section = { image: await image(400, 150, '#e8e3d9'), rooms: [{ name: 'Comedor', boundary: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] }], describe: read, withFurniture };
    const input = { ...base, document, view: viewFor('front'), styleAnchor: await image(200, 100, '#a07850'), acceptedDesign: true, section };
    const prepared = await prepareRenderImageRequest(input);
    expect(read).toHaveBeenCalledOnce();
    expect(prepared.request.prompt).toContain('mesa del diseño aceptado');
    expect(prepared.request.prompt).not.toContain('Los muebles dibujados en la imagen 1');
    // La cama del plano no aparece en la lectura de la cenital aceptada: no se dibuja.
    expect(withFurniture).not.toHaveBeenCalled();
    expect(prepared.request.prompt).not.toContain('dibujados en la imagen 1 tienen la orientación');
    await expect(prepareRenderImageRequest({ ...input, section: { ...section, describe: async () => ({ lines: [], pieces: [] }) } })).rejects.toThrow('antes de generar');
  });

  it('conserva la guía visual para la cenital que ya respetaba las estancias', async () => {
    const { request, reference: source } = await prepareRenderImageRequest({ ...base, view: viewFor('top') });
    expect(request.referenceImages).toEqual([source, spatial.image]);
    expect(request.prompt).toContain('la última referencia es un plano');
    // La guía cuadrada no decide el formato de la cámara panorámica.
    expect(request.aspectRatio).toBe('16:9');
  });

  it.each(['front', 'top', 'exterior'] as const)('mantiene los índices de máscara, identidad y entorno en %s', async preset => {
    const zoneMask = await image(160, 90, '#fff'), styleAnchor = await image(100, 100, '#a00');
    const environment = await image(100, 100, '#070');
    const { request, reference: source, zoneMask: mask } = await prepareRenderImageRequest({ ...base,
      view: viewFor(preset), options: { ...base.options, designScope: 'house' }, zoneMask, styleAnchor, environment });
    expect(request.referenceImages?.slice(0, 4)).toEqual([source, mask, styleAnchor, environment]);
    expect(request.referenceImages).toHaveLength(5);
    if (preset === 'top') expect(request.referenceImages!.at(-1)).toEqual(spatial.image);
    else expect(request.referenceImages).not.toContainEqual(spatial.image);
    expect(request.prompt).toContain('imagen 2 es su máscara');
    expect(request.prompt).toContain('imagen 3 es otra vista ya aceptada');
    expect(request.prompt).toContain('imagen 4 es la ortofoto');
  });

  it.each(['front', 'back', 'left', 'right'] as const)('el corte %s no destapa las habitaciones ocultas', async preset => {
    const { request } = await prepareRenderImageRequest({ ...base, view: { ...viewFor(preset), ceilingView: 'solid' } });
    expect(request.prompt).toContain('mantén la altura e inclinación');
    expect(request.prompt).toContain('no la conviertas en cenital');
    expect(request.prompt).toContain('Conserva las superficies de cubierta visibles');
  });
});

describe('formato de salida desde la captura principal', () => {
  it('añade margen a una captura panorámica sin cambiar ninguno de sus píxeles', async () => {
    const width = 182, height = 84;
    const pattern = Buffer.from(Array.from({ length: width * height * 3 }, (_, i) => i % 253));
    const source = { width, height, mimeType: 'image/png' as const,
      base64: (await sharp(pattern, { raw: { width, height, channels: 3 } }).png().toBuffer()).toString('base64') };
    const before = structuredClone(source);
    const framed = await fitRenderReferenceAspect(source);
    expect(framed.aspectRatio).toBe('21:9');
    expect(framed.image.width).toBeGreaterThan(width);
    expect(framed.image.height).toBe(height);
    const center = await sharp(Buffer.from(framed.image.base64, 'base64')).extract({
      left: Math.floor((framed.image.width - width) / 2), top: 0, width, height,
    }).removeAlpha().raw().toBuffer();
    expect(center.equals(pattern)).toBe(true);
    expect(source).toEqual(before);
    expect(framed.mask).toBeUndefined();
  });

  it('respeta una cámara vertical aunque la guía y el ancla sean horizontales', async () => {
    const { request } = await prepareRenderImageRequest({ ...base, reference: await image(90, 160),
      view: { ...viewFor('custom'), aspect: 9 / 16 }, styleAnchor: reference });
    expect(request.aspectRatio).toBe('9:16');
  });
});
