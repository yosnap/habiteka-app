import { describe, it, expect, beforeEach } from 'vitest';
import { setClipboard, hasClipboard, takeClipboardClones } from '@/canvas/canvas-clipboard';
import type { StructObj } from '@/canvas/types';

function obj(id: string, x = 0, y = 0): StructObj {
  return { id, kind: 'wall', x, y, width: 10, height: 10, rotation: 0 };
}

describe('canvas-clipboard — portapapeles del editor (module-level)', () => {
  beforeEach(() => setClipboard([]));

  it('hasClipboard refleja si hay contenido', () => {
    expect(hasClipboard()).toBe(false);
    setClipboard([obj('a')]);
    expect(hasClipboard()).toBe(true);
  });

  it('takeClipboardClones devuelve clones desplazados con ids nuevos', () => {
    setClipboard([obj('a', 5, 5)]);
    const clones = takeClipboardClones();
    expect(clones).toHaveLength(1);
    expect(clones[0]?.id).not.toBe('a');
    expect(clones[0]?.x).toBe(25); // 5 + offset 20
    expect(clones[0]?.y).toBe(25);
  });

  it('pegados sucesivos no colisionan en id (secuencia avanza)', () => {
    setClipboard([obj('a')]);
    const first = takeClipboardClones();
    const second = takeClipboardClones();
    expect(first[0]?.id).not.toBe(second[0]?.id);
  });

  it('el contenido sobrevive a múltiples lecturas (simula cambio de zona)', () => {
    setClipboard([obj('a'), obj('b')]);
    // Cambiar de zona NO toca el portapapeles: sigue disponible para pegar.
    expect(hasClipboard()).toBe(true);
    expect(takeClipboardClones()).toHaveLength(2);
    expect(hasClipboard()).toBe(true); // takeClones no vacía el buffer
  });
});
