import { describe, expect, it } from 'vitest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { parseEditorDocument } from '@/lib/editor-document/validation';
import { fitRenderBackdrop } from '@/lib/editor-document/render-backdrop';
import { sameDesignContent } from '@/lib/editor-document/approved-design';

describe('fondo auxiliar del plano actual', () => {
  it('ajusta una imagen conservando proporciones y la geometría, sin cambiar la identidad aprobada', () => {
    const document = { ...emptyEditorDocument(), vertices: [{ id: 'a', x: -2000, y: -1000 }, { id: 'b', x: 6000, y: 4000 }] };
    const backdrop = fitRenderBackdrop(document, 'own-render', 16 / 9);
    expect(backdrop.widthMm / backdrop.heightMm).toBeCloseTo(16 / 9);
    expect(backdrop.xMm + backdrop.widthMm / 2).toBe(2000);
    expect(backdrop.yMm + backdrop.heightMm / 2).toBe(1500);
    const result = parseEditorDocument({ ...document, renderBackdrop: backdrop });
    expect(result.vertices).toEqual(document.vertices);
    expect(sameDesignContent(result, document)).toBe(true);
  });
  it('rechaza proporciones inválidas y URLs persistidas en lugar de una referencia estable', () => {
    expect(() => fitRenderBackdrop(emptyEditorDocument(), 'render', 0)).toThrow();
    expect(() => parseEditorDocument({ ...emptyEditorDocument(), renderBackdrop: {
      ...fitRenderBackdrop(emptyEditorDocument(), 'render', 1), assetUrl: 'https://expired.example/image',
    } })).toThrow();
  });
});
