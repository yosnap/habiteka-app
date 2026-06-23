import { describe, it, expect } from 'vitest';
import {
  decorRecommendationPrompt,
  parseRecommendations,
} from '@/server/agent/phases/decoracion';

describe('decorRecommendationPrompt', () => {
  it('incluye estilo, objetivo y la descripción del plano', () => {
    const out = decorRecommendationPrompt('nordico', 'sala acogedora', 'Sofá al fondo');
    // El prompt usa la etiqueta legible, no el slug (la IA la entiende mejor).
    expect(out).toContain('Nórdico');
    expect(out).toContain('sala acogedora');
    expect(out).toContain('Sofá al fondo');
  });

  it('omite el objetivo si viene vacío', () => {
    const out = decorRecommendationPrompt('moderno', '   ', 'Plano X');
    expect(out).not.toContain('objetivo');
  });

  it('restringe a kinds del catálogo (lista de tipos permitidos)', () => {
    const out = decorRecommendationPrompt('nordico', '', 'Plano');
    // Algún kind de decoración/mobiliario debe ofrecerse como permitido.
    expect(out).toContain('alfombra');
  });
});

describe('parseRecommendations — validador (frontera de confianza)', () => {
  it('acepta recomendaciones con kind del catálogo y posición finita', () => {
    const out = parseRecommendations({
      recomendaciones: [
        { kind: 'alfombra', x: 100, y: 200, motivo: 'bajo la mesa' },
        { kind: 'planta', x: 50, y: 60, motivo: 'en la esquina' },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ kind: 'alfombra', x: 100, y: 200, motivo: 'bajo la mesa' });
  });

  it('descarta kinds inexistentes y kinds del catálogo fuera de scope (estructura)', () => {
    const out = parseRecommendations({
      recomendaciones: [
        { kind: 'dragon', x: 1, y: 2, motivo: 'no existe' },
        { kind: 'wall', x: 1, y: 2, motivo: 'estructura, fuera de scope' },
        { kind: 'foco', x: 1, y: 2, motivo: 'luz, fuera de scope de decoración' },
        { kind: 'planta', x: 1, y: 2, motivo: 'válida' },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe('planta');
  });

  it('descarta posiciones no finitas (NaN/Infinity) o no numéricas', () => {
    const out = parseRecommendations({
      recomendaciones: [
        { kind: 'planta', x: NaN, y: 2, motivo: 'x inválida' },
        { kind: 'planta', x: 1, y: Infinity, motivo: 'y inválida' },
        { kind: 'planta', x: '10', y: 2, motivo: 'x no número' },
      ],
    });
    expect(out).toHaveLength(0);
  });

  it('motivo ausente o no string cae a cadena vacía', () => {
    const out = parseRecommendations({ recomendaciones: [{ kind: 'planta', x: 1, y: 2 }] });
    expect(out[0]?.motivo).toBe('');
  });

  it('entrada malformada (no objeto, sin array) devuelve lista vacía', () => {
    expect(parseRecommendations(null)).toEqual([]);
    expect(parseRecommendations('texto')).toEqual([]);
    expect(parseRecommendations({ recomendaciones: 'no-array' })).toEqual([]);
    expect(parseRecommendations({})).toEqual([]);
  });
});
