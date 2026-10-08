import { describe, expect, it } from 'vitest';
import { FURNITURE_CATALOG, getFurnitureCatalogEntry, searchFurnitureCatalog } from '@/lib/editor-document/furniture-catalog';
import { furnitureRooms } from '@/lib/editor-document/furniture-rooms';
import { furnitureModel, modelTint } from '@/lib/editor-document/furniture-models';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { COMPANION_RULES, diningChairs, isDiningTable } from '@/lib/editor-document/native-design-seating';
import { windowDressingModelId } from '@/lib/editor-document/window-dressing-models';
import { placeFurniture } from '@/server/ai/sketch/place-furniture';
import type { PlanZone } from '@/lib/contracts';

describe('literas, cortinas, comedores completos y chill out', () => {
  it('solo interpreta como litera o comedor completo los bocetos que los identifican expresamente', () => {
    const zone: PlanZone = { id: 'z', name: 'Dormitorio infantil', walls: [], apertures: [], dimensions: [],
      outline: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }] };
    const box = { bbox: { minX: .1, minY: .1, maxX: .4, maxY: .5 }, rotacionDeg: 0 as const };
    const place = (tipo: 'bed' | 'table', etiqueta?: string) => placeFurniture([{ tipo, etiqueta, ...box }],
      { mmPerUnitX: 5000, mmPerUnitY: 5000 }, [{ ...zone, name: tipo === 'bed' ? zone.name : 'Comedor' }]).furniture[0]!;
    expect(place('bed').catalogId).not.toContain('litera');
    expect(place('bed', 'Litera familiar').catalogId).toContain('litera');
    expect(place('table').catalogId).not.toContain('set_comedor');
    expect(place('table', 'Set de comedor con sillas').catalogId).toContain('set_comedor');
  });
  it('ofrece tres tipos de litera en dormitorio e infantil con modelo y alturas de dos niveles', () => {
    const bunkBeds = searchFurnitureCatalog('litera', 'dormitorio');
    expect(bunkBeds).toHaveLength(4);
    expect(new Set(bunkBeds.map((entry) => entry.productId)).size).toBe(3);
    for (const entry of bunkBeds) {
      expect(furnitureRooms(entry)).toEqual(expect.arrayContaining(['dormitorio', 'infantil']));
      expect(entry.heightMm).toBeGreaterThanOrEqual(1750);
      expect(furnitureModel({ catalogId: entry.id })?.thumbnailUrl).toBeTruthy();
    }
    expect(bunkBeds.find((entry) => entry.id.includes('familiar'))!.variantLabel).toContain('135');
  });

  it('coloca cada comedor con mesa y sillas como un objeto y evita las sillas automáticas adicionales', () => {
    const sets = searchFurnitureCatalog('set de comedor', 'comedor');
    expect(sets).toHaveLength(3);
    for (const entry of sets) {
      const document = addFurniture(emptyEditorDocument(), entry, { x: 1000, y: 1000 });
      expect(document.furniture).toHaveLength(1);
      expect(document.furniture[0]).toMatchObject({ widthMm: entry.widthMm, depthMm: entry.depthMm, catalogId: entry.id });
      expect(furnitureModel(document.furniture[0]!)?.key).toBe(entry.id.split(':').pop());
      expect(isDiningTable(entry)).toBe(false);
      expect(COMPANION_RULES.find((rule) => rule.name === 'sillas')!.anchor(entry)).toBe(false);
      expect(diningChairs({ catalogId: entry.id, xMm: 0, yMm: 0, rotation: 0, reason: '' }, 'habiteka:furniture:silla-comedor')).toEqual([]);
    }
    expect(isDiningTable(getFurnitureCatalogEntry('habiteka:furniture:mesa-comedor'))).toBe(true);
  });

  it('mantiene modelos de cobertura y tintado en cortinas cortas y de ventanal, en las habitaciones', () => {
    const curtains = FURNITURE_CATALOG.filter((entry) => /cortina-(corta|ventanal)/.test(entry.id));
    expect(curtains).toHaveLength(6);
    for (const entry of curtains) {
      expect(furnitureRooms(entry)).toEqual(expect.arrayContaining(['decoracion', 'dormitorio', 'infantil', 'salon']));
      const item = addFurniture(emptyEditorDocument(), entry, { x: 0, y: 0 }).furniture[0]!;
      expect(windowDressingModelId({ ...item, coverage: .2 })).toContain('_c20');
      expect(windowDressingModelId({ ...item, coverage: 1 })).toContain('_c100');
      expect(furnitureModel(item)).toBeDefined();
      expect(modelTint(item)).toBe(entry.color);
      expect(item.elevationMm).toBe(entry.kind === 'cortina-corta' ? 900 : 0);
    }
  });

  it('ofrece sofás y sillones bajos en exterior y salón sin repetir estancias', () => {
    const seats = FURNITURE_CATALOG.filter((entry) => /chillout_bajo/.test(entry.id));
    expect(seats).toHaveLength(4);
    expect(new Set(seats.map((entry) => entry.profile))).toEqual(new Set(['sofa', 'chair']));
    for (const entry of seats) {
      const rooms = furnitureRooms(entry);
      expect(rooms).toEqual(['exterior', 'salon']);
      expect(entry.heightMm).toBeLessThan(700);
      expect(furnitureModel({ catalogId: entry.id })).toBeDefined();
    }
  });
});
