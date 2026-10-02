/**
 * Norma de producto: todos los desplegables son `ModernSelect`
 * (src/components/ui/modern-select.tsx). Un `<select>` nativo en JSX hace fallar
 * la suite para que no vuelva a colarse ninguno.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx|jsx)$/.test(name) ? [path] : [];
  });
}

describe('desplegables modernos', () => {
  it('no hay ningún <select> nativo en el frontend', () => {
    const offenders = sources('src').filter((path) =>
      // Etiqueta JSX real; los comentarios lo citan entre comillas invertidas.
      /(^|[^`])<select[\s>]/m.test(readFileSync(path, 'utf8')));
    expect(offenders, 'Usa ModernSelect de @/components/ui/modern-select').toEqual([]);
  });
});
