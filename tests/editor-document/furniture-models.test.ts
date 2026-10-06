/** Las piezas del catálogo que coloca Amueblar se ven con un modelo realista CC0, sin teñirlo con el color de catálogo. */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { furnitureModel, modelTint } from '@/lib/editor-document/furniture-models';
import { FURNITURE_CATALOG, getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import type { Furniture } from '@/lib/editor-document/schema';

const piece = (catalogId: string, color?: string) => {
  const entry = getFurnitureCatalogEntry(catalogId)!;
  return { id: 'f', catalogId, x: 0, y: 0, widthMm: entry.widthMm, depthMm: entry.depthMm, rotation: 0, color: color ?? entry.color } as unknown as Furniture;
};

describe('modelo realista de las piezas del catálogo', () => {
  it('cada pieza con modelo apunta a un GLB que existe', () => {
    const modelled = FURNITURE_CATALOG.filter((entry) => entry.id.startsWith('habiteka:furniture:') && furnitureModel({ catalogId: entry.id }));
    expect(modelled.length).toBeGreaterThan(25);
    for (const entry of modelled) expect(existsSync(join(process.cwd(), 'public', furnitureModel({ catalogId: entry.id })!.url)), entry.id).toBe(true);
  });

  it('la cama, la mesilla, el sofá, la silla de comedor, la alfombra y la lavadora tienen modelo; el horno de pie sigue con volúmenes', () => {
    for (const id of ['cama-doble', 'mesita', 'sofa-3', 'silla-comedor', 'mesa-comedor', 'taburete', 'lampara-mesa', 'alfombra', 'alfombra:grande'])
      expect(furnitureModel({ catalogId: `habiteka:furniture:${id}` }), id).toBeDefined();
    expect(furnitureModel({ catalogId: 'habiteka:furniture:lavadora' })?.url).toBe('/models/habiteka/lavadora_blanca.glb');
    expect(furnitureModel({ catalogId: 'habiteka:furniture:horno' })).toBeUndefined();
  });

  it('el color de catálogo deja las texturas del modelo; uno pintado lo tiñe', () => {
    expect(modelTint(piece('habiteka:furniture:cama-doble'))).toBeUndefined();
    expect(modelTint(piece('habiteka:furniture:cama-doble', '#335577'))).toBe('#335577');
    // El color neutro por defecto de los modelos (el que guardan los planos importados) tampoco tiñe.
    expect(modelTint(piece('habiteka:furniture:cama-doble:king', '#8ea69b'))).toBeUndefined();
  });

  it('los modelos antiguos de estilo plano se ven con su equivalente realista', () => {
    expect(furnitureModel({ catalogId: 'habiteka:asset:cama' })?.key).toBe('cama_hotel');
    expect(furnitureModel({ catalogId: 'habiteka:asset:inodoro' })?.key).toBe('inodoro');
  });
});
