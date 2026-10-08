import { describe, expect, it } from 'vitest';
import { validateRenderFidelity } from '@/server/agent/editor-v2/render-fidelity-verdict';
import { RENDER_FIDELITY_CRITERIA } from '@/lib/editor-document/render-fidelity';
import type { RenderSpatialContext } from '@/server/agent/editor-v2/render-spatial-context';

const context: RenderSpatialContext = { units: 'mm', levels: [{ id: 'l', name: 'Planta', rooms: [],
  openings: [{ id: 'L1-O1', kind: 'puerta', center: { x: 0, y: 0 }, widthMm: 800, heightMm: 2100 }] }] };
const verdict = (swingClear: string) => ({
  accepted: true, cameraAndGeometryPreserved: true, objectIdentityPreserved: true, redesignApplied: true, roomUsesPreserved: true,
  doorsPhysicallyCoherent: true, circulationPreserved: true, photorealistic: true,
  criteria: Object.keys(RENDER_FIDELITY_CRITERIA).map(id => ({ id, status: 'pass', observation: 'Comprobado en la imagen' })),
  roomChecks: [], openAreaChecks: [], violations: [],
  openingChecks: [{ id: 'L1-O1', status: 'pass', observation: 'Puerta del fondo vista de canto', observedKind: 'puerta', swingClear }],
  constructionCheck: { status: 'pass', observation: 'Sin construcciones nuevas' },
});

describe('veredicto de fidelidad de puertas', () => {
  it('en un alzado cortado no descarta por un giro que no se puede comprobar', () => {
    expect(validateRenderFidelity(verdict('uncertain'), false, context, undefined, true).status).toBe('passed');
    expect(() => validateRenderFidelity(verdict('blocked'), false, context, undefined, true)).toThrow(/puertas o huecos/);
  });
  it('acepta un hueco declarado no visible aunque marque su giro como no aplicable', () => {
    const hidden = verdict('not-applicable');
    hidden.openingChecks[0] = { ...hidden.openingChecks[0]!, status: 'pass', observedKind: 'not-visible' };
    expect(validateRenderFidelity(hidden, false, context).status).toBe('passed');
  });
  it('no borra un fallo explícito al normalizar un hueco ni permite perder un hueco visible', () => {
    const hidden = { ...verdict('not-applicable'), openingChecks: [{ id: 'L1-O1', status: 'fail',
      observedKind: 'not-visible', swingClear: 'not-applicable', observation: 'Puerta eliminada de la candidata' }] };
    expect(() => validateRenderFidelity(hidden, false, context)).toThrow(/puertas o huecos/);
    const missing = { ...hidden, openingChecks: [{ ...hidden.openingChecks[0]!, status: 'not-visible', referenceVisible: true }] };
    expect(() => validateRenderFidelity(missing, false, context)).toThrow(/ha desaparecido/);
    const outside = { ...missing, openingChecks: [{ ...missing.openingChecks[0]!, referenceVisible: false }] };
    expect(validateRenderFidelity(outside, false, context).status).toBe('passed');
    expect(() => validateRenderFidelity(outside, false, context, undefined, false, [], [], { fullPlan: true })).toThrow(/ha desaparecido/);
  });
  it('en una sección descarta una estancia abierta declarada no visible, pero no otras fuera de vista', () => {
    const rooms: RenderSpatialContext = { ...context, levels: [{ ...context.levels[0]!, rooms: [
      { id: 'L1-R1', name: 'Salón', anchor: { x: 0, y: 0 } }, { id: 'L1-R2', name: 'Cocina', anchor: { x: 0, y: 0 } }] }] } as RenderSpatialContext;
    const hidden = { ...verdict('clear'), roomChecks: [{ id: 'L1-R1', status: 'not-visible', observation: 'Fuera del encuadre' },
      { id: 'L1-R2', status: 'not-visible', observation: 'Detrás del tabique' }] };
    expect(validateRenderFidelity(structuredClone(hidden), false, rooms, undefined, true).status).toBe('passed');
    expect(() => validateRenderFidelity(structuredClone(hidden), false, rooms, undefined, true, ['L1-R2']))
      .toThrow(/uso de las estancias alterado/);
  });
  it('acepta un paso sin hoja descrito como libre, pero no un giro declarado en una ventana', () => {
    // La vista interior se descartaba porque la revisión marcaba «libre» un paso sin puerta.
    const opening = (kind: 'hueco' | 'ventana') => ({ ...context, levels: [{ ...context.levels[0]!,
      openings: [{ id: 'L1-O1', kind, center: { x: 0, y: 0 }, widthMm: 800, heightMm: 2100 }] }] }) as RenderSpatialContext;
    const passage = verdict('clear'); passage.openingChecks[0]!.observedKind = 'hueco';
    expect(validateRenderFidelity(passage, false, opening('hueco')).status).toBe('passed');
    const window = verdict('clear'); window.openingChecks[0]!.observedKind = 'ventana';
    expect(() => validateRenderFidelity(window, false, opening('ventana'))).toThrow(/puertas o huecos/);
  });
  it('fuera de los alzados cortados sigue exigiendo comprobar el giro', () => {
    expect(() => validateRenderFidelity(verdict('uncertain'), false, context)).toThrow(/no se pudo comprobar libre/);
  });
});
