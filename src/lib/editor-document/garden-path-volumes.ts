import type { Furniture } from './schema';
import type { FurnitureVolume } from './furniture-profiles';

export function gardenPathVolumes(item: Furniture): FurnitureVolume[] {
  const variant = item.catalogId?.split(':')[3] ?? 'losas', curb = variant.endsWith('-bordillo');
  const material = variant.replace('-bordillo', '');
  // La ficha histórica tiene fondo largo; los caminos trazados avanzan en X.
  const historical = item.catalogId === 'habiteka:outdoor:camino';
  const length = historical ? item.depthMm : item.widthMm, width = historical ? item.widthMm : item.depthMm;
  const base = item.elevationMm ?? 0, height = item.heightMm ?? 50;
  const parts: FurnitureVolume[] = [];
  const box = (x: number, y: number, w: number, d: number, bottom: number, top: number, materialId: string) => {
    parts.push({ x: historical ? y : x, y: historical ? x : y, widthMm: historical ? d : w,
      depthMm: historical ? w : d, bottom: base + bottom, top: base + top, color: '#ffffff', materialId, shape: 'rounded-box' });
  };
  const texture = material.includes('cesped') ? 'outdoor:grass-lawn-pbr' : material.includes('grava') ? 'polyhaven:gravel_road'
    : material === 'tierra' ? 'polyhaven:brown_mud_dry' : material === 'adoquin' ? 'polyhaven:brick_pavement_02' : 'ambientcg:Tiles143';
  box(0, 0, length, width, 0, height*.4, texture);
  if (material === 'losas' || material.startsWith('pasos')) {
    const count = Math.max(1, Math.ceil(length / 650)), step = length/count, gap = material === 'losas' ? 12 : Math.min(150, step*.25);
    for (let i = 0; i < count; i++) box(i*step+gap/2, width*.08, step-gap, width*.84, height*.4, height, 'ambientcg:Tiles143');
  }
  if (curb) for (const side of [0, width-80]) box(0, side, length, Math.min(80, width), height*.4, height+100, 'ambientcg:Concrete034');
  return parts;
}
