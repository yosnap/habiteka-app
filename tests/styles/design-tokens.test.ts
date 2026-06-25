import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { wcagContrast, parse } from 'culori';

// Lee los tokens como texto: el design system vive en CSS (fuente única), así que
// el test valida directamente ese archivo en lugar de una copia en TS.
const tokensCss = readFileSync(
  fileURLToPath(new URL('../../src/styles/tokens.css', import.meta.url)),
  'utf8',
);

function tokenValue(name: string): string {
  const match = new RegExp(`${name}:\\s*(oklch\\([^)]*\\))`).exec(tokensCss);
  if (!match) throw new Error(`Token no encontrado: ${name}`);
  return match[1]!;
}

function contrast(a: string, b: string): number {
  return wcagContrast(parse(tokenValue(a))!, parse(tokenValue(b))!);
}

describe('design tokens', () => {
  it('declara las variables @theme clave', () => {
    for (const name of [
      '--color-brand-500',
      '--color-ink',
      '--color-surface',
      '--color-danger',
      '--color-success',
    ]) {
      expect(tokensCss).toContain(name);
    }
  });

  it('texto principal sobre superficie cumple contraste AA (≥ 4.5:1)', () => {
    expect(contrast('--color-ink', '--color-surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('texto atenuado sobre superficie cumple contraste AA', () => {
    expect(contrast('--color-ink-soft', '--color-surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('texto principal sobre superficie atenuada cumple contraste AA', () => {
    expect(contrast('--color-ink', '--color-surface-muted')).toBeGreaterThanOrEqual(4.5);
  });

  it('los colores de marca y peligro como texto sobre blanco cumplen AA', () => {
    // Botones/enlaces de marca y mensajes de error usan estos tonos como texto.
    expect(contrast('--color-brand-700', '--color-surface')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('--color-danger', '--color-surface')).toBeGreaterThanOrEqual(4.5);
  });
});
