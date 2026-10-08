/**
 * La maqueta del modelo (muros, huecos y cubierta) se proyecta con la cámara de la isométrica aceptada: cae sobre la casa,
 * respeta las bandas del formato de salida y se recorta al inmueble para guiar la forma de la cubierta.
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { PerspectiveCamera } from 'three';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { setExteriorRoof } from '@/lib/editor-document/exterior-roof';
import type { RenderView } from '@/lib/editor-document/render-view';
import { projectRoofModel, roofModelGuidePng } from '@/server/agent/editor-v2/roof-closure-projection';
import { roofClosurePrompt, roofClosureReport } from '@/server/agent/editor-v2/roof-closure-prompt';

const house = () => setExteriorRoof(addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 8000 }, { x: 0, y: 8000 }], true),
  { kind: 'hip', pitchDeg: 20, eavesMm: 500, openings: [{ id: 'chimenea', kind: 'chimney', x: 6000, y: 3000, widthMm: 500, depthMm: 500, heightMm: 1200, rotation: 0 }] });

function isometric(aspect = 16 / 9): RenderView {
  const camera = new PerspectiveCamera(40, aspect);
  camera.position.set(19, 15, 17); camera.lookAt(5, 1.5, 4); camera.updateMatrixWorld();
  return { preset: 'isometric', position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), focus: [5, 1.5, 4],
    fov: 40, aspect, allLevels: false, cutaway: false, ceilingView: 'hidden' };
}

describe('cubierta del modelo desde la cámara aceptada', () => {
  it('proyecta faldones y chimenea dentro de la imagen, en torno al centro de la casa', () => {
    const projection = projectRoofModel(house(), isometric(), 1600, 900);
    const kinds = new Set(projection.triangles.map(item => item.kind));
    expect(kinds.has('roof')).toBe(true);
    expect(kinds.has('chimney')).toBe(true);
    const { x, y, width, height } = projection.bbox;
    expect(x).toBeGreaterThan(0); expect(y).toBeGreaterThan(0);
    expect(x + width).toBeLessThan(1); expect(y + height).toBeLessThan(1);
    // La cámara mira al centro de la casa: la cubierta lo rodea.
    expect(x).toBeLessThan(.5); expect(x + width).toBeGreaterThan(.5);
  });

  it('respeta las bandas que añade el formato de salida cuando la cámara no tiene su proporción', () => {
    // 2:1 se completa hasta 16:9 con bandas arriba y abajo: la cubierta se comprime hacia el centro en vertical.
    const wide = projectRoofModel(house(), isometric(2), 1600, 900).bbox;
    const band = (1 - (16 / 9) / 2) / 2;
    expect(wide.y).toBeGreaterThan(band);
    expect(wide.y + wide.height).toBeLessThan(1 - band);
  });

  it('dibuja muros, huecos y cubierta y recorta la guía al inmueble', async () => {
    const projection = projectRoofModel(house(), isometric(), 800, 450);
    const kinds = new Set(projection.triangles.map(item => item.kind));
    expect(kinds.has('wall')).toBe(true);
    // La cubierta se pinta después de los muros: desde arriba siempre queda encima.
    const lastWall = projection.triangles.map(item => item.kind).lastIndexOf('wall');
    expect(projection.triangles.findIndex(item => item.kind === 'roof')).toBeGreaterThan(lastWall);
    const guide = await sharp(await roofModelGuidePng(projection, '#57534e', 800, 450)).metadata();
    expect(guide.width).toBeLessThan(800);
    expect(guide.width).toBeGreaterThan(projection.bbox.width * 800);
  });

  it('rechaza un plano sin cubierta o una vista de todas las plantas', () => {
    const plain = addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }], true);
    expect(() => projectRoofModel(plain, isometric(), 800, 450)).toThrow('no tiene cubierta');
    expect(() => projectRoofModel(house(), { ...isometric(), allLevels: true }, 800, 450)).toThrow('una sola planta');
  });

  it('describe la cubierta del modelo sin nombrar acabados interiores', () => {
    const doc = setExteriorRoof(house(), { materialId: 'ambientcg:Carpet012' });
    const prompt = roofClosurePrompt(doc);
    expect(prompt).toContain('cubierta a cuatro aguas de 20° de pendiente');
    expect(prompt).toContain('alero de 50 cm');
    expect(prompt).toContain('chimenea de obra');
    expect(prompt).toContain('imagen 2 es una maqueta');
    expect(prompt).not.toMatch(/moqueta|carpet/i);
  });

  it('descarta la imagen con tejado si un criterio falla o es dudoso y exige un informe completo', () => {
    const pass = { status: 'pass', observation: 'Coincide.' };
    expect(roofClosureReport({ roof: pass, framing: pass, identity: pass, photorealistic: pass }, 'visión').status).toBe('passed');
    const doubtful = roofClosureReport({ roof: { status: 'uncertain', observation: 'No se ve la chimenea.' }, framing: pass, identity: pass, photorealistic: pass });
    expect(doubtful.status).toBe('rejected');
    expect(doubtful.violations![0]).toContain('No se ve la chimenea.');
    expect(() => roofClosureReport({ roof: pass })).toThrow('no es válido');
  });
});
