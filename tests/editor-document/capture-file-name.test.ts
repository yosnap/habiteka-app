import { describe, expect, it } from 'vitest';
import { captureFileName } from '@/lib/editor-document/capture-file-name';

describe('nombre de archivo de una vista descargada', () => {
  it.each([
    ['Isométrica · Día', 0, 'isometrica-dia.png'],
    ['Salón / Cocina · Frontal', 1, 'salon-cocina-frontal.png'],
    ['  Vista actual  ', 2, 'vista-actual.png'],
  ])('%s → %s', (label, index, expected) => {
    expect(captureFileName(label, index)).toBe(expected);
  });

  it('usa un nombre numerado si la etiqueta no tiene caracteres válidos', () => {
    expect(captureFileName('···', 2)).toBe('vista-3.png');
  });
});
