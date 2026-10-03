import { describe, expect, it } from 'vitest';
import type { DesignVideoReference } from '@/lib/editor-document/design-video';
import { designConstructionSelectionIssue, designVideoPreparationIssue } from '@/lib/editor-document/design-video-readiness';

const reference = (id: string, extra: Partial<DesignVideoReference> = {}): DesignVideoReference => ({
  id, name: 'Diseño', view: 'Cenital', preset: 'top', batchId: 'batch-a', revision: 1,
  zones: [], scope: 'all', closedRoof: false, url: '/design.png', ...extra,
});
const layout = reference('layout');
const roof = reference('roof', { preset: 'exterior', view: 'Exterior terminado', closedRoof: true });
const ready = { goal: 'construction' as const, approved: true, loading: false, approvalId: 'approval', providerReady: true, references: [layout, roof] };

describe('preparación del vídeo desde diseños', () => {
  it('permite preparar distribución y exterior de una misma tanda', () => {
    expect(designConstructionSelectionIssue(ready.references)).toBeNull();
    expect(designVideoPreparationIssue(ready)).toBeNull();
  });
  it('bloquea una mezcla de tandas aunque incluya distribución y exterior', () => {
    expect(designConstructionSelectionIssue([layout, { ...roof, batchId: 'batch-b' }])).toContain('misma tanda');
  });
  it('bloquea referencias sin identidad de tanda', () => {
    expect(designConstructionSelectionIssue([{ ...layout, batchId: null }, { ...roof, batchId: null }])).toContain('misma tanda');
  });
  it('no deja continuar con una aceptación retirada o una imagen descartada', () => {
    expect(designConstructionSelectionIssue([{ ...layout, issue: 'Acepta el diseño antes de usarlo.' }, roof])).toContain('Acepta el diseño');
    expect(designConstructionSelectionIssue([layout, { ...roof, issue: 'Falta el tejado.' }])).toContain('Falta el tejado');
  });
  it('explica qué falta cuando la selección está vacía o incompleta', () => {
    expect(designConstructionSelectionIssue([])).toContain('Elige');
    expect(designConstructionSelectionIssue([roof])).toContain('cenital');
    expect(designConstructionSelectionIssue([layout])).toContain('exterior terminado');
  });
  it.each(['isometric', 'drone'] as const)('admite %s como distribución alternativa', preset => {
    expect(designConstructionSelectionIssue([{ ...layout, preset }, roof])).toBeNull();
  });
  it('no utiliza un lateral como referencia de distribución', () => {
    expect(designConstructionSelectionIssue([{ ...layout, preset: 'left' }, roof])).toContain('cenital');
  });
  it('limita a nueve referencias y rechaza duplicados', () => {
    expect(designConstructionSelectionIssue([...ready.references, ...Array.from({ length: 8 }, (_, i) => reference(`extra-${i}`))])).toContain('nueve');
    expect(designConstructionSelectionIssue([layout, layout, roof])).toContain('No repitas');
  });
  it('bloquea mientras se actualizan las imágenes o falla su carga', () => {
    expect(designVideoPreparationIssue({ ...ready, loading: true })).toContain('Cargando');
    expect(designVideoPreparationIssue({ ...ready, loadError: 'Desconexión' })).toContain('Actualizar diseños');
  });
  it('distingue aprobar la versión del proyecto de aceptar las imágenes', () => {
    expect(designVideoPreparationIssue({ ...ready, approved: false })).toContain('no acepta las imágenes');
    expect(designVideoPreparationIssue({ ...ready, approvalId: null })).toContain('versión del proyecto');
  });
  it('explica el proveedor ausente aunque las referencias estén listas', () => {
    expect(designVideoPreparationIssue({ ...ready, providerReady: false })).toContain('KIE no está activo');
  });
  it('en primera persona exige una estancia verificable y no admite las vistas de construcción', () => {
    expect(designVideoPreparationIssue({ ...ready, goal: 'visit' })).toContain('estancia interior verificada');
    const interior = reference('interior', { preset: 'custom', interiorRoomId: 'room', interiorRoomName: 'Salón', closedRoof: true });
    expect(designVideoPreparationIssue({ ...ready, goal: 'visit', references: [interior] })).toBeNull();
    expect(designVideoPreparationIssue({ ...ready, goal: 'visit', references: [interior, { ...interior, id: 'other', interiorRoomId: 'another-room' }] })).toContain('toma por estancia');
  });
});
