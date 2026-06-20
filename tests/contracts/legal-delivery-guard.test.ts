/**
 * Guard legal a nivel de tipos: un `Collected` incompleto (sin `estilo` o con
 * `entregables` vacío) NO debe ser asignable a `ReadyForDelivery`.
 *
 * Las directivas `@ts-expect-error` SON la aserción: si alguna asignación
 * inválida dejara de fallar (porque el tipo se relajó), `tsc` reportaría una
 * directiva sin uso y la compilación fallaría. El bloque runtime solo confirma
 * que el módulo carga.
 */
import { describe, it, expect } from 'vitest';
import type { Collected, ReadyForDelivery } from '@/lib/contracts';

// Caso válido: estilo presente y al menos un entregable ⇒ asignable.
const completo: Collected = { estilo: 'moderno', entregables: ['plano2d'] };
const listo: ReadyForDelivery = {
  estilo: 'moderno',
  entregables: ['plano2d', 'render3d'],
};

// Falta `estilo` ⇒ NO listo para entrega.
const sinEstilo: Collected = { entregables: ['plano2d'] };
// @ts-expect-error estilo es obligatorio en ReadyForDelivery
const _bloqueoSinEstilo: ReadyForDelivery = sinEstilo;

// `entregables` vacío ⇒ NO listo para entrega.
const sinEntregables: Collected = { estilo: 'moderno', entregables: [] };
// @ts-expect-error entregables debe tener al menos un elemento
const _bloqueoSinEntregables: ReadyForDelivery = sinEntregables;

describe('guard legal de entrega (tipado)', () => {
  it('un Collected completo satisface ReadyForDelivery', () => {
    expect(completo.entregables).toHaveLength(1);
    expect(listo.estilo).toBe('moderno');
    expect(listo.entregables.length).toBeGreaterThan(0);
  });

  it('los casos incompletos quedan bloqueados por el tipo', () => {
    // Las asignaciones bloqueadas existen solo para ejercer @ts-expect-error;
    // se referencian aquí para que no figuren como valores muertos.
    void _bloqueoSinEstilo;
    void _bloqueoSinEntregables;
    expect(sinEstilo.estilo).toBeUndefined();
    expect(sinEntregables.entregables).toHaveLength(0);
  });
});
