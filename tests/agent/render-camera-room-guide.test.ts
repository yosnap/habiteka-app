import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import sharp from 'sharp';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';
import type { RenderView } from '@/lib/editor-document/render-view';
import { renderSpatialContext } from '@/server/agent/editor-v2/render-spatial-context';
import { cameraRoomLabelLayout, cameraRoomLabels, renderCameraRoomGuide } from '@/server/agent/editor-v2/render-camera-room-guide';
import { selectedViewImagePrompt } from '@/server/agent/editor-v2/selected-view-image-prompt';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { setDesignSpaceKind } from '@/lib/editor-document/spatial-properties';
import { assertEditorDocument } from '@/lib/editor-document/validation';

function plan() {
  const doc = setDesignSpaceKind(emptyEditorDocument(), 'casa');
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const id = `${col}:${row}`;
    doc.vertices.push({ id, x: col * 2000, y: row * 2000 });
    for (const end of [col < 2 ? `${col + 1}:${row}` : null, row < 2 ? `${col}:${row + 1}` : null])
      if (end) doc.walls.push({ id: `${id}-${end}`, startVertexId: id, endVertexId: end,
        heightMm: 2700, thicknessMm: 120, dimensionalOrigin: 'physical',
        materials: { left: 'plaster-white', right: 'plaster-white' }, colors: { left: '#eeeeee', right: '#eeeeee' } });
  }
  doc.labels = [{ id: 'a', x: 1000, y: 1000, text: 'Dormitorio' }, { id: 'b', x: 3000, y: 1000, text: 'Salón' },
    { id: 'c', x: 1000, y: 3000, text: 'Lavadero' }, { id: 'd', x: 3000, y: 3000, text: 'Cocina' }];
  assertEditorDocument(doc);
  return doc;
}
const doc = plan(), options = defaultRenderDesignOptions();
const positions = { front: [2, 3, 10], back: [2, 3, -6], left: [-6, 3, 2], right: [10, 3, 2] } as const;
const frame = { sourceWidth: 1600, sourceHeight: 900, crop: { left: 0, top: 0, width: 1600, height: 900 } };
function cameraView(preset: keyof typeof positions): RenderView {
  const position = positions[preset], camera = new PerspectiveCamera(45, 16 / 9);
  camera.position.set(position[0], position[1], position[2]); camera.lookAt(2, 1.5, 2);
  const cutawayWallIds = editorDocumentToScene(doc).exteriorWalls.filter(wall =>
    (position[0] - wall.x) * wall.normalX + (position[2] - wall.z) * wall.normalZ > .01).map(wall => wall.sourceEntityId);
  return { preset, position: [...position], focus: [2, 1.5, 2], quaternion: camera.quaternion.toArray(),
    fov: 45, aspect: 16 / 9, cutaway: true, allLevels: false, ceilingView: 'hidden', cutawayWallIds };
}

describe('usos del plano localizados en la cámara del diseño', () => {
  it('separa los nombres de estancias estrechas sin cambiar sus puntos interiores', () => {
    const rooms = ['Dormitorio principal', 'Pasillo', 'Baño', 'Aseo', 'Lavadero'].map((name, i) => ({
      id: `room-${i}`, name, x: .45 + i * .025, y: i === 1 ? .6 : .7,
    }));
    const before = structuredClone(rooms), labels = cameraRoomLabelLayout(rooms, { width: 1800, height: 800 });
    expect(labels.map(label => label.room)).toEqual(rooms);
    expect(rooms).toEqual(before);
    for (const [i, label] of labels.entries()) {
      expect(label.left).toBeGreaterThanOrEqual(0);
      expect(label.top).toBeGreaterThanOrEqual(0);
      expect(label.left + label.width).toBeLessThanOrEqual(1800);
      expect(label.top + label.height).toBeLessThanOrEqual(800);
      for (const room of rooms) {
        const coversPoint = room.x * 1800 >= label.left && room.x * 1800 <= label.left + label.width &&
          room.y * 800 >= label.top && room.y * 800 <= label.top + label.height;
        expect(coversPoint).toBe(false);
      }
      for (const other of labels.slice(i + 1)) {
        const overlaps = label.left < other.left + other.width && other.left < label.left + label.width &&
          label.top < other.top + other.height && other.top < label.top + label.height;
        expect(overlaps).toBe(false);
      }
    }
  });

  it.each([
    ['front', ['Lavadero', 'Cocina']], ['back', ['Salón', 'Dormitorio']],
    ['left', ['Dormitorio', 'Lavadero']], ['right', ['Cocina', 'Salón']],
  ] as const)('%s muestra sus estancias de izquierda a derecha sin trasladar las del fondo', (preset, expected) => {
    const view = cameraView(preset), context = renderSpatialContext(doc, view, options);
    const before = structuredClone(doc), labels = cameraRoomLabels(doc, view, context, frame, { width: 1600, height: 900 });
    expect(labels.map(label => label.name)).toEqual(expected);
    expect(labels.every(label => label.x > 0 && label.x < 1 && label.y > 0 && label.y < 1)).toBe(true);
    expect(doc).toEqual(before);
  });

  it('no etiqueta habitaciones a través de una fachada cerrada', () => {
    const view = { ...cameraView('front'), cutaway: false, cutawayWallIds: [] };
    expect(cameraRoomLabels(doc, view, renderSpatialContext(doc, view, options), frame, { width: 1600, height: 900 })).toEqual([]);
  });

  it('distingue una estancia del fondo vista a través de un hueco sin convertirla en otra estancia del corte', () => {
    const opened = plan();
    opened.openings = [{ id: 'passage', wallId: '0:1-1:1', kind: 'hueco', position: .5,
      widthMm: 900, heightMm: 2100, elevationMm: 0, dimensionalOrigin: 'physical',
      catalogId: 'test:passage', hinge: 'left', swing: 'left', openAngleDeg: 0,
      colors: { frame: '#eeeeee', leaf: '#cccccc' } }];
    assertEditorDocument(opened);
    const camera = new PerspectiveCamera(45, 16 / 9);
    camera.position.set(1, 1, 8); camera.lookAt(1, 1, 1);
    const view: RenderView = { ...cameraView('front'), position: camera.position.toArray(),
      focus: [1, 1, 1], quaternion: camera.quaternion.toArray() };
    const before = structuredClone(opened), context = renderSpatialContext(opened, view, options);
    const rooms = cameraRoomLabels(opened, view, context, frame, { width: 1600, height: 900 });
    expect(rooms.find(room => room.name === 'Dormitorio')?.visibility).toBe('through-opening');
    expect(rooms.find(room => room.name === 'Lavadero')?.visibility).toBe('direct');
    expect(opened).toEqual(before);
    const layout = cameraRoomLabelLayout(rooms, { width: 1600, height: 900 });
    expect(layout.find(label => label.room.name === 'Dormitorio')?.caption).toBe('Dormitorio · al fondo');
    expect(layout.find(label => label.room.name === 'Lavadero')?.caption).toBe('Lavadero');
    const prompt = selectedViewImagePrompt(opened, view, 'moderno', options, '', '', false, false, false, context, { rooms });
    expect(prompt).toContain('"visibility":"through-opening"');
    const closed = { ...opened, openings: [] };
    expect(cameraRoomLabels(closed, view, renderSpatialContext(closed, view, options), frame,
      { width: 1600, height: 900 }).some(room => room.name === 'Dormitorio')).toBe(false);
  });

  it('respeta una cubierta cerrada y la oculta únicamente en las vistas que muestran el interior', () => {
    const covered = { ...doc, exteriorRoof: { kind: 'flat' as const, pitchDeg: 0, orientationDeg: 0,
      thicknessMm: 160, eavesMm: 0, color: '#555555', roomIds: deriveRoomsSafe(doc).map(room => room.id) } };
    const camera = new PerspectiveCamera(45, 16 / 9);
    camera.position.set(2, 10, 2.1); camera.lookAt(2, 0, 2);
    const view: RenderView = { ...cameraView('front'), preset: 'custom', position: camera.position.toArray(),
      quaternion: camera.quaternion.toArray(), ceilingView: 'solid', cutaway: false, cutawayWallIds: [] };
    const context = renderSpatialContext(covered, view, options);
    expect(cameraRoomLabels(covered, view, context, frame, { width: 1600, height: 900 })).toEqual([]);
    expect(cameraRoomLabels(covered, { ...view, preset: 'isometric', ceilingView: 'hidden' }, context,
      frame, { width: 1600, height: 900 })).toHaveLength(4);
  });

  it('adapta los puntos al recorte y al margen sin cambiar su ubicación dentro del inmueble', () => {
    const view = cameraView('front'), context = renderSpatialContext(doc, view, options);
    const full = cameraRoomLabels(doc, view, context, frame, { width: 1600, height: 900 });
    const crop = { left: 400, top: 100, width: 800, height: 750 };
    const cropped = cameraRoomLabels(doc, view, context, { ...frame, crop }, { width: 1000, height: 750 });
    expect(cropped).toHaveLength(full.length);
    for (const label of cropped) {
      const original = full.find(item => item.id === label.id)!;
      expect(label.x * 1000).toBeCloseTo(original.x * 1600 - 400 + 100);
      expect(label.y * 750).toBeCloseTo(original.y * 900 - 100);
    }
  });

  it('anota una copia de la captura, filtra los nombres ocultos del prompt y respeta la máscara', async () => {
    const view = cameraView('front'), context = renderSpatialContext(doc, view, options);
    const reference = { width: 1600, height: 900, mimeType: 'image/png' as const,
      base64: (await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#ddd' } }).png().toBuffer()).toString('base64') };
    const original = reference.base64;
    const guide = await renderCameraRoomGuide(doc, view, context, reference, frame);
    expect(guide.rooms.map(room => room.name)).toEqual(['Lavadero', 'Cocina']);
    expect((await sharp(Buffer.from(guide.image!.base64, 'base64')).metadata())).toMatchObject({ width: 1600, height: 900 });
    expect(reference.base64).toBe(original);
    const prompt = selectedViewImagePrompt(doc, view, 'moderno', options, '', '', false, false, false, context, guide);
    expect(prompt).toContain('COPIA ANOTADA');
    expect(prompt).toContain('"name":"Lavadero"');
    expect(prompt).not.toContain('"name":"Dormitorio"');
    expect(prompt).not.toContain('"name":"Salón"');
    const blackMask = { ...reference, base64: (await sharp({ create: { width: 1600, height: 900,
      channels: 3, background: '#000' } }).png().toBuffer()).toString('base64') };
    expect(await renderCameraRoomGuide(doc, view, context, reference, frame, blackMask)).toEqual({ rooms: [] });
  });
});
