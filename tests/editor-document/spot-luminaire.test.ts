import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { addLuminaire, luminaireKindPatch, setRoomCeiling, updateLuminaire } from '@/lib/editor-document/ceiling-commands';
import {
  ceilingWarnings, luminaireDepthMm, luminaireRadiusMm, resolvedLuminaires, spotAimPoint, spotAimVector,
} from '@/lib/editor-document/ceiling-geometry';
import { parseEditorDocument } from '@/lib/editor-document/validation';

const room = () => addWallPath(emptyEditorDocument(), [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }], true);
const ceiling = (patch = {}) => { const doc = room(); return setRoomCeiling(doc, deriveRooms(doc)[0]!.id, patch); };
const aimOf = (tiltDeg: number, azimuthDeg: number, heightMm = 2500) => spotAimPoint({
  luminaire: { id: 'l', ceilingId: 'c', kind: 'spot', x: 1000, y: 2000, dropMm: 0, color: '#ffffff',
    temperatureK: 3000, lumens: 550, enabled: true, mount: 'surface', tiltDeg, azimuthDeg },
  heightMm, floorElevationMm: 0,
});

describe('foco orientable', () => {
  it('apunta a su propia vertical sin inclinación y alcanza la altura por la tangente', () => {
    expect(aimOf(0, 0)).toEqual({ x: 1000, y: 2000 });
    const diagonal = aimOf(45, 0);
    expect(diagonal.x).toBeCloseTo(3500); expect(diagonal.y).toBeCloseTo(2000);
    const lateral = aimOf(45, 90);
    expect(lateral.x).toBeCloseTo(1000); expect(lateral.y).toBeCloseTo(4500);
    // Los cuatro cuadrantes del plano, con el giro horario en planta.
    for (const [azimuth, dx, dy] of [[0, 1, 0], [90, 0, 1], [180, -1, 0], [270, 0, -1]] as const) {
      const point = aimOf(45, azimuth);
      expect(point.x).toBeCloseTo(1000 + 2500 * dx); expect(point.y).toBeCloseTo(2000 + 2500 * dy);
    }
    // La altura libre descuenta el suelo acabado.
    expect(spotAimPoint({ luminaire: { ...aimSource(), tiltDeg: 45, azimuthDeg: 0 }, heightMm: 2500, floorElevationMm: 500 }).x).toBeCloseTo(3000);
  });
  it('comparte con la escena 3D el mismo vector de apuntado', () => {
    const vector = spotAimVector({ ...aimSource(), tiltDeg: 30, azimuthDeg: 120 });
    expect(Math.hypot(vector.x, vector.y, vector.down)).toBeCloseTo(1);
    const aim = aimOf(30, 120, 2500);
    expect(aim.x - 1000).toBeCloseTo(2500 * vector.x / vector.down);
    expect(aim.y - 2000).toBeCloseTo(2500 * vector.y / vector.down);
    expect(spotAimVector({ ...aimSource(), kind: 'flush' })).toEqual({ x: 0, y: 0, down: 1 });
  });
  it('nace en superficie sobre techo plano y exige falso techo si se empotra', () => {
    const doc = ceiling(), id = doc.ceilings![0]!.id;
    const lit = addLuminaire(doc, id, 'spot', { x: 2500, y: 2500 });
    const light = lit.luminaires![0]!;
    expect(light).toMatchObject({ kind: 'spot', mount: 'surface', tiltDeg: 30, azimuthDeg: 0, lumens: 550, dropMm: 0 });
    expect(lit.schemaVersion).toBe(12);
    expect(parseEditorDocument(JSON.parse(JSON.stringify(lit)))).toEqual(lit);
    expect(() => updateLuminaire(lit, light.id, { mount: 'recessed' })).toThrow('falso techo');
    const lowered = ceiling({ kind: 'suspended', dropMm: 150 });
    const suspended = addLuminaire(lowered, lowered.ceilings![0]!.id, 'spot', { x: 2500, y: 2500 });
    const embedded = updateLuminaire(suspended, suspended.luminaires![0]!.id, { mount: 'recessed' });
    expect(embedded.luminaires![0]!.mount).toBe('recessed');
    expect(luminaireRadiusMm('spot', 'recessed')).toBe(60);
    expect(luminaireRadiusMm('spot', 'surface')).toBe(90);
    expect(luminaireDepthMm('spot', 'recessed')).toBe(12);
    expect(luminaireDepthMm('spot', 'surface')).toBe(110);
  });
  it('limpia montaje, inclinación y giro al pasar a un tipo no orientable', () => {
    const doc = ceiling(), id = doc.ceilings![0]!.id;
    const lit = addLuminaire(doc, id, 'spot', { x: 2500, y: 2500 }), lightId = lit.luminaires![0]!.id;
    const flush = updateLuminaire(lit, lightId, luminaireKindPatch('flush'));
    expect(Object.keys(flush.luminaires![0]!)).not.toContain('tiltDeg');
    expect(flush.luminaires![0]!).not.toHaveProperty('mount');
    expect(flush.luminaires![0]!).not.toHaveProperty('azimuthDeg');
    // Y al volver al foco recupera los valores de partida.
    expect(updateLuminaire(flush, lightId, luminaireKindPatch('spot')).luminaires![0]!)
      .toMatchObject({ kind: 'spot', mount: 'surface', tiltDeg: 30, azimuthDeg: 0 });
    expect(lit.luminaires![0]!.tiltDeg).toBe(30);
  });
  it('avisa cuando el haz cae fuera de la estancia, sin bloquear el muro medianero', () => {
    const doc = ceiling(), id = doc.ceilings![0]!.id;
    const lit = addLuminaire(doc, id, 'spot', { x: 2500, y: 2500 });
    const lightId = lit.luminaires![0]!.id;
    expect(ceilingWarnings(lit)).toEqual([]);
    const wall = updateLuminaire(lit, lightId, { tiltDeg: 45 });
    expect(ceilingWarnings(wall)).toEqual([]);
    const outside = updateLuminaire(lit, lightId, { tiltDeg: 60 });
    expect(ceilingWarnings(outside).join(' ')).toContain('fuera de la estancia');
    // Es un aviso, no un bloqueo: la luz sigue resuelta para 2D, 3D e IA.
    expect(resolvedLuminaires(outside)).toHaveLength(1);
    expect(resolvedLuminaires(outside)[0]!.aim!.x).toBeGreaterThan(5000);
  });
});

const aimSource = () => ({ id: 'l', ceilingId: 'c', kind: 'spot' as const, x: 1000, y: 2000, dropMm: 0,
  color: '#ffffff', temperatureK: 3000, lumens: 550, enabled: true, mount: 'surface' as const, tiltDeg: 30, azimuthDeg: 0 });
