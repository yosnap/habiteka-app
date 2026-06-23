import { describe, it, expect } from 'vitest';
import {
  ESTILOS,
  ENTREGABLES,
  ESTILO_VALUES,
  ENTREGABLE_VALUES,
  isValidEstilo,
  isValidEntregable,
  estiloLabel,
} from '@/lib/design-options';

describe('design-options (fuente única de opciones de interacción)', () => {
  it('expone los 15 estilos con su etiqueta', () => {
    expect(ESTILO_VALUES).toEqual(
      expect.arrayContaining([
        // 7 originales
        'minimalista',
        'moderno',
        'clasico',
        'industrial',
        'rustico',
        'mediterraneo',
        'nordico',
        // 8 nuevos (ampliación Tier 2 Planner5D)
        'japandi',
        'boho',
        'midcentury',
        'costero',
        'contemporaneo',
        'escandinavo',
        'artdeco',
        'tropical',
      ]),
    );
    expect(ESTILO_VALUES).toHaveLength(15);
    // Cada estilo tiene una etiqueta no vacía (para la UI).
    for (const e of ESTILOS) expect(e.label.length).toBeGreaterThan(0);
  });

  it('estiloLabel traduce slug→etiqueta legible (y deja pasar lo desconocido)', () => {
    expect(estiloLabel('midcentury')).toBe('Mid-century');
    expect(estiloLabel('artdeco')).toBe('Art Déco');
    expect(estiloLabel('desconocido')).toBe('desconocido');
  });

  it('expone los 3 entregables con su etiqueta', () => {
    expect(ENTREGABLE_VALUES).toEqual(
      expect.arrayContaining(['plano2d', 'render3d', 'memoria']),
    );
    expect(ENTREGABLE_VALUES).toHaveLength(3);
    for (const e of ENTREGABLES) expect(e.label.length).toBeGreaterThan(0);
  });

  it('valida estilos contra la lista única', () => {
    expect(isValidEstilo('nordico')).toBe(true);
    expect(isValidEstilo('inventado')).toBe(false);
    expect(isValidEstilo(42)).toBe(false);
  });

  it('valida entregables contra la lista única', () => {
    expect(isValidEntregable('render3d')).toBe(true);
    expect(isValidEntregable('otro')).toBe(false);
  });
});
