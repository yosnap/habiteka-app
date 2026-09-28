import { describe, expect, it } from 'vitest';
import { catalogFurnitureVolumes } from '@/lib/editor-document/furniture-profiles';
import type { Furniture } from '@/lib/editor-document/schema';

function bed(widthMm: number, catalogId: string): Furniture {
  return { id: 'bed', kind: 'bed', catalogId, x: 0, y: 0,
    widthMm, depthMm: 2000, rotation: 0, dimensionalOrigin: 'physical' };
}

describe('representación de las camas del catálogo', () => {
  it('da una almohada a la cama individual y dos a la doble', () => {
    const single = catalogFurnitureVolumes(bed(1000, 'habiteka:furniture:cama-individual'))!;
    const double = catalogFurnitureVolumes(bed(1600, 'habiteka:furniture:cama-doble'))!;
    expect(single.filter((part) => part.shape === 'ellipsoid')).toHaveLength(1);
    expect(double.filter((part) => part.shape === 'ellipsoid')).toHaveLength(2);
    expect(single.filter((part) => part.shape === 'rounded-box')).toHaveLength(4);
  });

  it('mantiene ropa de cama y almohadas dentro de la huella y la altura del mueble', () => {
    const item = bed(1000, 'habiteka:furniture:cama-individual');
    const volumes = catalogFurnitureVolumes(item)!;
    for (const part of volumes) {
      expect(part.x).toBeGreaterThanOrEqual(0);
      expect(part.y).toBeGreaterThanOrEqual(0);
      expect(part.x + part.widthMm).toBeLessThanOrEqual(item.widthMm);
      expect(part.y + part.depthMm).toBeLessThanOrEqual(item.depthMm);
      expect(part.bottom).toBeGreaterThanOrEqual(0);
      expect(part.top).toBeLessThanOrEqual(900);
    }
  });
});
