import { describe, expect, it } from 'vitest';
import { twoRoomDocument } from '../fixtures/two-room-document';
import { renderViewIntegrityIssue } from '@/lib/editor-document/render-view-integrity';

describe('integridad del recorte antes de usar una foto', () => {
  it('exige que Exterior terminado tenga cubierta y fachadas sin corte', () => {
    const doc = twoRoomDocument();
    expect(renderViewIntegrityIssue(doc, { preset: 'exterior', cutaway: false, ceilingView: 'solid' })).toBeNull();
    expect(renderViewIntegrityIssue(doc, { preset: 'exterior', cutaway: true, ceilingView: 'solid', cutawayWallIds: ['w0'] })).toContain('fachadas completas');
    expect(renderViewIntegrityIssue(doc, { preset: 'exterior', cutaway: false, ceilingView: 'hidden' })).toContain('cubierta visible');
  });
  it('admite retirar una fachada y rechaza un tabique compartido sin alterar el plano', () => {
    const doc = twoRoomDocument(), before = JSON.stringify(doc);
    expect(renderViewIntegrityIssue(doc, { cutaway: true, cutawayWallIds: ['w0'] })).toBeNull();
    expect(renderViewIntegrityIssue(doc, { cutaway: true, cutawayWallIds: ['w0', 'w6'] })).toContain('1 tabiques interiores');
    expect(JSON.stringify(doc)).toBe(before);
  });
  it('conserva tabiques abiertos dentro de una estancia', () => {
    const doc = twoRoomDocument();
    doc.vertices.push({ id: 'tip', x: 1500, y: 2000 });
    doc.walls.push({ id: 'spur', startVertexId: 'a', endVertexId: 'tip', thicknessMm: 150, dimensionalOrigin: 'physical' });
    expect(renderViewIntegrityIssue(doc, { cutaway: true, cutawayWallIds: ['spur'] })).toContain('tabiques interiores');
  });
  it('bloquea metadatos contradictorios, ausentes o de otra planta', () => {
    const doc = twoRoomDocument();
    expect(renderViewIntegrityIssue(doc)).toContain('vista registrada');
    expect(renderViewIntegrityIssue(doc, { cutaway: true })).toContain('No se registraron');
    expect(renderViewIntegrityIssue(doc, { cutaway: false, cutawayWallIds: ['w0'] })).toContain('sin un recorte válido');
    expect(renderViewIntegrityIssue(doc, { cutaway: true, levelId: 'another', cutawayWallIds: ['w0'] })).toContain('esta planta');
    expect(renderViewIntegrityIssue(doc, { cutaway: true, cutawayWallIds: ['missing'] })).toContain('esta planta');
  });
  it('consulta la planta de la imagen y comprueba todos los niveles si el recorte abarca el edificio', () => {
    const doc = twoRoomDocument(), upper = twoRoomDocument();
    upper.walls.forEach(wall => { wall.id = `upper-${wall.id}`; });
    doc.levels = [{ id: 'lower', name: 'Baja', heightMm: 2700 }, { id: 'upper', name: 'Alta', heightMm: 2700, document: upper }];
    doc.activeLevelId = 'lower';
    expect(renderViewIntegrityIssue(doc, { cutaway: true, levelId: 'upper', cutawayWallIds: ['upper-w0'] })).toBeNull();
    expect(renderViewIntegrityIssue(doc, { cutaway: true, cutawayWallIds: ['upper-w0'] })).toContain('esta planta');
    expect(renderViewIntegrityIssue(doc, { cutaway: true, allLevels: true, cutawayWallIds: ['upper-w6'] })).toContain('tabiques interiores');
  });
});
