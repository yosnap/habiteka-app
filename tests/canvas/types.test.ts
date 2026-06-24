import { describe, it, expect } from 'vitest';
import {
  placementOf,
  CEILING_KINDS,
  WALL_SURFACE_KINDS,
} from '@/canvas/types';
import type { CeilingKind, WallSurfaceKind, StructKind } from '@/canvas/types';

describe('placementOf', () => {
  it("'wall' → 'wall' (elemento estructural, no es mueble)", () => {
    expect(placementOf('wall')).toBe('wall');
  });

  it("'door' → 'wall-child'", () => {
    expect(placementOf('door')).toBe('wall-child');
  });

  it("'window' → 'wall-child'", () => {
    expect(placementOf('window')).toBe('wall-child');
  });

  it('CeilingKind → ceiling (todos)', () => {
    for (const kind of CEILING_KINDS) {
      expect(placementOf(kind)).toBe('ceiling');
    }
  });

  it("'ceiling_light' → 'ceiling'", () => {
    expect(placementOf('ceiling_light' as CeilingKind)).toBe('ceiling');
  });

  it("'pendant_lamp' → 'ceiling'", () => {
    expect(placementOf('pendant_lamp' as CeilingKind)).toBe('ceiling');
  });

  it('WallSurfaceKind → wall-surface (todos)', () => {
    for (const kind of WALL_SURFACE_KINDS) {
      expect(placementOf(kind)).toBe('wall-surface');
    }
  });

  it("'outlet' → 'wall-surface'", () => {
    expect(placementOf('outlet' as WallSurfaceKind)).toBe('wall-surface');
  });

  it("'tv_mount' → 'wall-surface'", () => {
    expect(placementOf('tv_mount' as WallSurfaceKind)).toBe('wall-surface');
  });

  it('kinds de suelo → floor', () => {
    const floorKinds: StructKind[] = [
      'sofa', 'cama', 'mesa', 'silla', 'armario',
      'nevera', 'inodoro', 'lavabo', 'lampara', 'planta',
    ];
    for (const kind of floorKinds) {
      expect(placementOf(kind), `placementOf('${kind}')`).toBe('floor');
    }
  });
});

describe('CEILING_KINDS', () => {
  it('contiene los 8 kinds de techo', () => {
    expect(CEILING_KINDS.size).toBe(8);
    expect(CEILING_KINDS.has('ceiling_light')).toBe(true);
    expect(CEILING_KINDS.has('skylight')).toBe(true);
  });
});

describe('WALL_SURFACE_KINDS', () => {
  it('contiene los 7 kinds de superficie de muro', () => {
    expect(WALL_SURFACE_KINDS.size).toBe(7);
    expect(WALL_SURFACE_KINDS.has('outlet')).toBe(true);
    expect(WALL_SURFACE_KINDS.has('radiator')).toBe(true);
  });
});
