/**
 * Norma de producto: ninguna ventana nativa del navegador (confirm, alert,
 * prompt). Bloquean la página y no siguen el diseño; se usan confirmaciones y
 * campos en línea (`@/components/ui/inline-confirm-button`).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?|jsx?)$/.test(name) ? [path] : [];
  });
}

describe('sin diálogos nativos', () => {
  it('no se llama a window.confirm, alert ni prompt', () => {
    const call = /(^|[^.\w`])(window\.)?(confirm|alert|prompt)\s*\(/;
    const offenders = sources('src').filter((path) => readFileSync(path, 'utf8').split('\n')
      .some((line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && call.test(line)));
    expect(offenders, 'Usa una confirmación en línea (InlineConfirmButton)').toEqual([]);
  });
});
