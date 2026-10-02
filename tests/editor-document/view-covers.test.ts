import { describe, expect, it } from 'vitest';
import { AERIAL_VIEWS, isViewCover, viewCoverIds } from '@/lib/editor-document/view-covers';
import { isBoundaryKind } from '@/lib/editor-document/boundary-types';

const item = (id: string, kind: string) => ({ id, kind });

describe('cubiertas que tapan las vistas aéreas', () => {
  it.each(['pergola', 'pergola-aluminio', 'pergola-metal', 'carpa', 'toldo', 'sombrilla'])('%s se quita en vista aérea', (kind) => {
    expect(isViewCover({ kind })).toBe(true);
  });

  it.each(['sofa-exterior', 'mesa-jardin', 'jardinera', 'valla-madera', 'piscina', 'coche'])('%s se conserva', (kind) => {
    expect(isViewCover({ kind })).toBe(false);
  });

  it('devuelve solo los ids de las cubiertas de un plano', () => {
    const furniture = [item('a', 'carpa'), item('b', 'sofa-exterior'), item('c', 'pergola-metal'), item('d', 'sombrilla')] as never;
    expect([...viewCoverIds({ furniture })].sort()).toEqual(['a', 'c', 'd']);
  });

  it('aplica a cenital, isométrica y dron, no a los alzados', () => {
    expect([...AERIAL_VIEWS].sort()).toEqual(['drone', 'isometric', 'top']);
    expect(AERIAL_VIEWS.has('front')).toBe(false);
  });

  // Vallas, cercas y setos son decorado de la parcela, no muros: ninguna vista los oculta.
  it.each(['valla-madera', 'cerca-metal', 'seto'])('%s nunca se oculta en ninguna vista', (kind) => {
    expect(isBoundaryKind(kind)).toBe(true);
    expect(isViewCover({ kind })).toBe(false);
    expect([...viewCoverIds({ furniture: [item('v', kind)] as never })]).toEqual([]);
  });
});
