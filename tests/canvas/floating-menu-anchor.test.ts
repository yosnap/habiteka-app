import { describe, it, expect } from 'vitest';
import {
  selectionAabb,
  worldToScreen,
  anchorPosition,
  type StageView,
  type Viewport,
} from '@/canvas/floating-menu-anchor';
import type { StructObj } from '@/canvas/types';

const obj = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation = 0,
): StructObj => ({ id, kind: 'wall', x, y, width: w, height: h, rotation });

const IDENTITY: StageView = { scale: 1, x: 0, y: 0 };
const VIEWPORT: Viewport = { width: 1000, height: 800 };
const MENU = { width: 200, height: 40 };

describe('selectionAabb', () => {
  it('devuelve null sin ids o sin coincidencias', () => {
    expect(selectionAabb([obj('a', 0, 0, 10, 10)], [])).toBeNull();
    expect(selectionAabb([obj('a', 0, 0, 10, 10)], ['z'])).toBeNull();
  });

  it('un objeto sin rotación = su propio rect', () => {
    expect(selectionAabb([obj('a', 100, 50, 40, 20)], ['a'])).toEqual({
      x: 100,
      y: 50,
      width: 40,
      height: 20,
    });
  });

  it('objeto rotado 90° sobre su esquina expande el AABB', () => {
    // 40x20 rotado 90° sobre (0,0): las esquinas van a (0,0),(0,40),(-20,40),(-20,0).
    const aabb = selectionAabb([obj('a', 0, 0, 40, 20, 90)], ['a']);
    expect(aabb).not.toBeNull();
    expect(aabb!.x).toBeCloseTo(-20, 5);
    expect(aabb!.y).toBeCloseTo(0, 5);
    expect(aabb!.width).toBeCloseTo(20, 5);
    expect(aabb!.height).toBeCloseTo(40, 5);
  });

  it('multi-objeto = unión de sus bounds', () => {
    const aabb = selectionAabb(
      [obj('a', 0, 0, 10, 10), obj('b', 90, 40, 10, 10)],
      ['a', 'b'],
    );
    expect(aabb).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });
});

describe('worldToScreen', () => {
  it('vista identidad no cambia el punto', () => {
    expect(worldToScreen({ x: 30, y: 40 }, IDENTITY)).toEqual({ x: 30, y: 40 });
  });

  it('aplica escala y pan', () => {
    const view: StageView = { scale: 2, x: 100, y: -50 };
    expect(worldToScreen({ x: 30, y: 40 }, view)).toEqual({ x: 160, y: 30 });
  });
});

describe('anchorPosition', () => {
  it('coloca el menú ENCIMA del bbox cuando cabe, centrado', () => {
    const aabb = { x: 400, y: 300, width: 100, height: 80 };
    const r = anchorPosition(aabb, IDENTITY, VIEWPORT, MENU);
    expect(r.placement).toBe('top');
    expect(r.x).toBeCloseTo(450, 5); // centro X del bbox
    expect(r.y).toBeLessThan(300); // por encima del top del bbox
  });

  it('cae DEBAJO si no hay espacio arriba', () => {
    const aabb = { x: 400, y: 0, width: 100, height: 40 };
    const r = anchorPosition(aabb, IDENTITY, VIEWPORT, MENU);
    expect(r.placement).toBe('bottom');
    expect(r.y).toBeGreaterThanOrEqual(40);
  });

  it('respeta la franja superior reservada (toolbar)', () => {
    // El bbox cabría arriba sin reserva, pero con 100px reservados ya no.
    const aabb = { x: 400, y: 120, width: 100, height: 40 };
    const r = anchorPosition(aabb, IDENTITY, VIEWPORT, MENU, 100);
    expect(r.placement).toBe('bottom');
  });

  it('clamp horizontal en el borde izquierdo', () => {
    const aabb = { x: 0, y: 300, width: 10, height: 10 };
    const r = anchorPosition(aabb, IDENTITY, VIEWPORT, MENU);
    expect(r.x).toBeGreaterThanOrEqual(MENU.width / 2); // no se sale por la izquierda
  });

  it('clamp horizontal en el borde derecho', () => {
    const aabb = { x: 995, y: 300, width: 10, height: 10 };
    const r = anchorPosition(aabb, IDENTITY, VIEWPORT, MENU);
    expect(r.x).toBeLessThanOrEqual(VIEWPORT.width - MENU.width / 2);
  });
});
