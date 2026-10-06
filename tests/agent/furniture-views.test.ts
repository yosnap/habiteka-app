/**
 * Los muebles del editor fijan el diseño base: su giro dice hacia dónde mira cada cama o sofá, y así lo describen la
 * cenital y cada alzado en vez de dejar que el generador lo adivine.
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument, type EditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { furnitureFacing, planFurnitureLines } from '@/server/agent/editor-v2/furniture-views';
import { rasterizeEditorElevation, sectionFurnitureDescription, sectionRooms } from '@/server/agent/editor-v2/rasterize-editor-elevation';
import { rasterizeEditorDocument } from '@/server/agent/editor-v2/rasterize-editor-document';
import { simplePlanPrompt, simpleSectionPrompt } from '@/server/agent/editor-v2/simple-plan-prompt';
import { defaultRenderDesignOptions } from '@/lib/editor-document/render-design-options';

// Dormitorio de 4 × 4 m con la cama de matrimonio y el cabecero contra el muro de arriba (y = 0).
const bed = (rotation = 0): Furniture => ({ id: 'b1', kind: 'cama-doble', catalogId: 'habiteka:furniture:cama-doble',
  x: 1200, y: 0, widthMm: 1600, depthMm: 2100, rotation, dimensionalOrigin: 'physical' });
const bedroom = (): EditorDocument => {
  const doc = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
  return { ...doc, labels: [{ id: 'l1', x: 2000, y: 3500, text: 'Dormitorio' }], furniture: [bed()] };
};
const pixels = async (base64: string, hex: string) => {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const { data, info } = await sharp(Buffer.from(base64, 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let i = 0; i < info.width * info.height; i++)
    if (Math.abs(data[i * 3]! - r!) < 6 && Math.abs(data[i * 3 + 1]! - g!) < 6 && Math.abs(data[i * 3 + 2]! - b!) < 6) count++;
  return count;
};

describe('orientación de los muebles del plano', () => {
  it('ve de espaldas desde la trasera la cama con el cabecero en esa fachada, de frente desde delante y de perfil desde un lado', () => {
    expect(furnitureFacing(bed(), [0, -1])).toBe('espaldas');
    expect(furnitureFacing(bed(), [0, 1])).toBe('frente');
    expect(furnitureFacing(bed(), [-1, 0])).toBe('perfil');
    expect(furnitureFacing(bed(90), [1, 0])).toBe('espaldas');
  });
  it('describe en la cenital el lado del cabecero y en cada alzado cómo se ve la cama', () => {
    const doc = bedroom();
    const room = sectionRooms(doc, 'back');
    expect(planFurnitureLines(doc, room)).toEqual(['Dormitorio: cama doble (cabecero arriba)']);
    expect(sectionFurnitureDescription(doc, 'back', room)[0]).toContain('cama doble vista de espaldas');
    expect(sectionFurnitureDescription(doc, 'front', sectionRooms(doc, 'front'))[0]).toContain('vista de frente');
    expect(sectionFurnitureDescription(doc, 'left', sectionRooms(doc, 'left'))[0]).toContain('de perfil, con el cabecero a la izquierda');
  });
  it('dibuja la trasera del cabecero en la sección trasera y el colchón en la frontal', async () => {
    const doc = bedroom();
    const back = (await rasterizeEditorElevation(doc, 'back', { cut: true }))!.base64;
    const front = (await rasterizeEditorElevation(doc, 'front', { cut: true }))!.base64;
    expect(await pixels(back, '#b2a189')).toBeGreaterThan(20_000);
    // El cambio de encuadre puede mezclar unos píxeles de borde; no debe aparecer un panel de cabecero de espaldas.
    expect(await pixels(front, '#b2a189')).toBeLessThan(20);
    expect(await pixels(front, '#f7f3ec')).toBeGreaterThan(await pixels(back, '#f7f3ec') * 3);
  });
  it('marca en el plano 2D las almohadas en el lado del cabecero', async () => {
    const plan = await rasterizeEditorDocument(bedroom());
    expect(await pixels(plan.base64, '#f8f5ee')).toBeGreaterThan(100);
  });
  it('usa muebles del plano para la cenital inicial y del diseño aceptado para la sección', () => {
    const options = defaultRenderDesignOptions();
    const plan = simplePlanPrompt('moderno', options, '', '', { units: 'mm', levels: [{ id: 'l', name: 'Planta', openings: [],
      rooms: [{ id: 'R1', name: 'Dormitorio', anchor: { x: 0, y: 0 } }] }] }, ['Dormitorio: cama doble (cabecero arriba)']);
    expect(plan).toContain('Respeta los muebles dibujados, con su posición, tamaño y orientación: Dormitorio: cama doble (cabecero arriba).');
    expect(plan).toContain('Conserva solo el mobiliario dibujado en el plano');
    expect(plan).not.toContain('Completa la decoración');
    const section = simpleSectionPrompt('back', 'moderno', options, '', '', ['Dormitorio'], ['Dormitorio: cama doble vista de espaldas']);
    expect(section).toContain('leído del diseño aceptado de la imagen 2: Dormitorio: cama doble vista de espaldas');
    expect(section).not.toContain('Los muebles dibujados en la imagen 1');
  });
});
