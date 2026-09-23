/**
 * Lógica del asistente por pasos: derivación del paso desde la fase persistida,
 * condiciones de avance y enlace a «Diseños».
 */
import { describe, expect, it } from 'vitest';
import {
  canAdvanceFrom,
  deliverablesHref,
  editorHref,
  isStepReachable,
  missingForGenerate,
  planStepFromState,
  stepFromPhase,
  stepTitle,
  stepsFor,
} from '@/components/chat/wizard-steps';

describe('stepFromPhase', () => {
  it('arranca en el paso 1 en ingesta sin detección', () => {
    expect(stepFromPhase('ingesta', false)).toBe(1);
  });

  it('pasa a revisar lo detectado cuando hay detección', () => {
    expect(stepFromPhase('ingesta', true)).toBe(2);
  });

  it('mapea cualificación al estilo, entrega a la confirmación y feedback al resultado', () => {
    expect(stepFromPhase('cualificacion', false)).toBe(3);
    expect(stepFromPhase('entrega', false)).toBe(5);
    expect(stepFromPhase('feedback', false)).toBe(6);
  });
});

describe('canAdvanceFrom', () => {
  it('exige estilo en el paso 3 y al menos un entregable en el 4', () => {
    expect(canAdvanceFrom(3, { entregables: [] })).toBe(false);
    expect(canAdvanceFrom(3, { estilo: 'costero', entregables: [] })).toBe(true);
    expect(canAdvanceFrom(4, { estilo: 'costero', entregables: [] })).toBe(false);
    expect(canAdvanceFrom(4, { estilo: 'costero', entregables: ['render3d'] })).toBe(true);
  });

  it('no bloquea los pasos sin selección obligatoria', () => {
    expect(canAdvanceFrom(1, { entregables: [] })).toBe(true);
    expect(canAdvanceFrom(5, { entregables: [] })).toBe(true);
  });
});

describe('missingForGenerate', () => {
  it('señala lo que falta en orden: estilo, entregables, Términos', () => {
    expect(missingForGenerate({ entregables: [] }, true)).toMatch(/estilo/i);
    expect(missingForGenerate({ estilo: 'nordico', entregables: [] }, true)).toMatch(/entregable/i);
    expect(missingForGenerate({ estilo: 'nordico', entregables: ['memoria'] }, null)).toMatch(
      /Términos/,
    );
  });

  it('devuelve null cuando todo está listo', () => {
    expect(missingForGenerate({ estilo: 'nordico', entregables: ['memoria'] }, true)).toBeNull();
  });
});

describe('deliverablesHref', () => {
  it('conserva la zona activa', () => {
    expect(deliverablesHref('p1', null)).toBe('/projects/p1/deliverables');
    expect(deliverablesHref('p1', 'z9')).toBe('/projects/p1/deliverables?zona=z9');
  });
});

describe('isStepReachable', () => {
  const none = { entregables: [] as never[] };
  const full = { estilo: 'costero' as const, entregables: ['render3d' as const] };

  it('en ingesta sin detección solo deja ir al 1; con detección, adelante según lo elegido', () => {
    expect(isStepReachable(1, { intent: 'design', phase: 'ingesta', hasDetection: false, selection: none })).toBe(true);
    expect(isStepReachable(2, { intent: 'design', phase: 'ingesta', hasDetection: false, selection: none })).toBe(false);
    expect(isStepReachable(3, { intent: 'design', phase: 'ingesta', hasDetection: false, selection: full })).toBe(false);
    expect(isStepReachable(3, { intent: 'design', phase: 'ingesta', hasDetection: true, selection: none })).toBe(true);
    expect(isStepReachable(4, { intent: 'design', phase: 'ingesta', hasDetection: true, selection: none })).toBe(false);
    expect(isStepReachable(5, { intent: 'design', phase: 'ingesta', hasDetection: true, selection: full })).toBe(true);
    expect(isStepReachable(6, { intent: 'design', phase: 'ingesta', hasDetection: true, selection: full })).toBe(false);
  });

  it('en cualificación exige estilo para el 4 y estilo + entregables para el 5', () => {
    const base = { intent: 'design' as const, phase: 'cualificacion' as const, hasDetection: true };
    expect(isStepReachable(2, { ...base, selection: none })).toBe(true);
    expect(isStepReachable(4, { ...base, selection: none })).toBe(false);
    expect(isStepReachable(4, { ...base, selection: { estilo: 'moderno', entregables: [] } })).toBe(true);
    expect(isStepReachable(5, { ...base, selection: { estilo: 'moderno', entregables: [] } })).toBe(false);
    expect(isStepReachable(5, { ...base, selection: full })).toBe(true);
    expect(isStepReachable(6, { ...base, selection: full })).toBe(false);
  });

  it('tras generar permite volver a los pasos de preferencias y no a la subida; generando, nada', () => {
    expect(isStepReachable(6, { intent: 'design', phase: 'feedback', hasDetection: true, selection: full })).toBe(true);
    expect(isStepReachable(5, { intent: 'design', phase: 'feedback', hasDetection: true, selection: full })).toBe(true);
    expect(isStepReachable(1, { intent: 'design', phase: 'feedback', hasDetection: true, selection: full })).toBe(false);
    expect(isStepReachable(5, { intent: 'design', phase: 'entrega', hasDetection: true, selection: full })).toBe(false);
  });
});

describe('rutas por intención', () => {
  it('cada ruta tiene sus pasos y sus títulos', () => {
    expect(stepsFor('design').map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(stepsFor('plan').map((s) => s.id)).toEqual([1, 2, 3]);
    expect(stepTitle('design', 2)).toBe('Revisa lo detectado');
    expect(stepTitle('plan', 2)).toBe('Revisa tu plano');
    // Un paso que no existe en la ruta no inventa título.
    expect(stepTitle('plan', 6)).toBe('');
  });

  it('la ruta del plano avanza con la lectura y con la aplicación al editor', () => {
    expect(planStepFromState({ hasImport: false, applied: false })).toBe(1);
    expect(planStepFromState({ hasImport: true, applied: false })).toBe(2);
    expect(planStepFromState({ hasImport: true, applied: true })).toBe(3);
  });

  it('en la ruta del plano no se salta a revisar sin plano ni a los siguientes pasos sin aplicar', () => {
    const inicio = { intent: 'plan' as const, hasImport: false, applied: false };
    expect(isStepReachable(1, inicio)).toBe(true);
    expect(isStepReachable(2, inicio)).toBe(false);
    expect(isStepReachable(3, inicio)).toBe(false);

    const leido = { intent: 'plan' as const, hasImport: true, applied: false };
    expect(isStepReachable(2, leido)).toBe(true);
    expect(isStepReachable(3, leido)).toBe(false);

    const aplicado = { intent: 'plan' as const, hasImport: true, applied: true };
    expect(isStepReachable(3, aplicado)).toBe(true);
    // Subir otro plano siempre es posible.
    expect(isStepReachable(1, aplicado)).toBe(true);
  });

  it('el enlace al editor conserva la zona activa', () => {
    expect(editorHref('p1', null)).toBe('/projects/p1');
    expect(editorHref('p1', 'z9')).toBe('/projects/p1?zona=z9');
  });
});
