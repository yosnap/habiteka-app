import sharp from 'sharp';
import path from 'node:path';
import type { EditorDocument, Furniture, Point } from '@/lib/editor-document/schema';
import { boundaryDefaults, isBoundary, isLegacyBoundary, planObjects } from '@/lib/editor-document/boundary-types';
import { boundaryVolumes } from '@/lib/editor-document/boundary-volumes';
import { outdoorVolumes } from '@/lib/editor-document/outdoor-volumes';
import { exteriorRoomSurfaces, isExteriorObject, isVehicle } from '@/lib/editor-document/exterior-design-context';
import { surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { layeredTerrainSurfaces } from '@/lib/editor-document/terrain-surfaces';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { isPainted, type FurnitureVolume } from '@/lib/editor-document/furniture-profiles';
import { VEHICLE_FACTORY_PAINT, vehicleType } from '@/lib/editor-document/vehicle-type';

const points = (p: Point[]) => p.map(q => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ');
const color = (value?: string, fallback = '#687477') => /^#[\da-f]{6}$/i.test(value ?? '') ? value! : fallback;
function volumeFootprint(item: Furniture, part: FurnitureVolume) {
  return [[0, 0], [part.widthMm, 0], [part.widthMm, part.depthMm], [0, part.depthMm]]
    .map(([x, y]) => localToWorld(item, localToWorld({ ...part, rotation: part.rotation ?? 0 }, { x: x!, y: y! })));
}
function drawVolumes(item: Furniture, parts: FurnitureVolume[]) {
  return [...parts].sort((a, b) => a.top - b.top).map(part =>
    `<polygon points="${points(volumeFootprint(item, part))}" fill="${color(part.color ?? item.color)}" stroke="#46544c" stroke-width="16"/>`).join('');
}
const boundaries = (doc: EditorDocument) => planObjects(doc)
  .filter(item => isBoundary(item) || isLegacyBoundary(item))
  .map(item => isBoundary(item) ? item : boundaryDefaults(item));

/** Incluye también los extremos de puertas de cerco abiertas, sin recortarlos en el encuadre. */
export function exteriorBoundsPoints(doc: EditorDocument): Point[] {
  return [
    ...(doc.terrainSurfaces ?? []).flatMap(surface => [
      { x: surface.x, y: surface.y }, { x: surface.x + surface.widthMm, y: surface.y + surface.depthMm },
    ]),
    ...boundaries(doc).flatMap(item => boundaryVolumes(item).flatMap(part => volumeFootprint(item, part))),
    ...doc.furniture.filter(isExteriorObject).flatMap(item => outdoorVolumes(item).flatMap(part => volumeFootprint(item, part))),
  ];
}
export function exteriorBoundarySymbols(doc: EditorDocument): string {
  return boundaries(doc).map(item => drawVolumes(item, boundaryVolumes(item))).join('');
}

/** Guía técnica de identidad: carrocería, cuatro ruedas, cristales y faros; no un rectángulo de madera. */
export function exteriorFurnitureSymbol(item: Furniture): string | undefined {
  if (!isExteriorObject(item)) return undefined;
  if (isLegacyBoundary(item) || isBoundary(item)) return '';
  if (isVehicle(item)) {
    const type = vehicleType(item), van = type === 'van', suv = type === 'suv';
    // La carrocería se ve como en el editor: pintada por el usuario o con la pintura del modelo. El color de catálogo
    // no pinta el modelo, y la guía mostraba gris azulada una furgoneta que en el editor es blanca.
    const paint = isPainted(item) ? color(item.color, VEHICLE_FACTORY_PAINT[type]) : VEHICLE_FACTORY_PAINT[type];
    const rect = (x: number, y: number, w: number, d: number, fill: string, radius = 0) =>
      `<rect x="${x * item.widthMm}" y="${y * item.depthMm}" width="${w * item.widthMm}" height="${d * item.depthMm}" rx="${radius * item.widthMm}" fill="${fill}"/>`;
    return `<g transform="translate(${item.x} ${item.y}) rotate(${item.rotation})">${
      [0, .88].flatMap(x => [.16, .7].map(y => rect(x, y, .12, .15, '#252b2e', .025))).join('')
    }${rect(.06, .025, .88, .95, paint, van ? .05 : suv ? .08 : .15)}${rect(.16, van ? .15 : .3, .68, van ? .17 : .45, '#344951', .09)}${
      rect(.19, van ? .32 : .4, .62, van ? .56 : .23, paint, .04)
    }${suv ? [.11, .85].map(x => rect(x, .32, .04, .4, '#53646b')).join('') : ''}${
      van ? rect(.19, .88, .62, .015, '#53646b') + rect(.495, .895, .01, .05, '#53646b') : ''
    }${[.15, .7].map(x => rect(x, .03, .15, .04, '#f8ebbf')).join('')}${
      [.15, .7].map(x => rect(x, .93, .15, .03, '#b85148')).join('')}</g>`;
  }
  const volumes = outdoorVolumes(item);
  return volumes.length ? drawVolumes(item, volumes) : undefined;
}

/** Albedos del catálogo local: césped, grava y pavimento llevan su textura real en la referencia. */
export async function terrainSymbols(doc: EditorDocument): Promise<string> {
  const exteriorFloors = exteriorRoomSurfaces(doc);
  const terrain = layeredTerrainSurfaces(doc).map(surface => ({ ...surface, footprint: undefined as Point[] | undefined }));
  const surfaces = [...terrain, ...exteriorFloors.map(surface => ({ ...surface.finish, footprint: surface.footprint,
    x: 0, y: 0, widthMm: 0, depthMm: 0 }))];
  const layers = await Promise.all(surfaces.map(async (surface, index) => {
    const material = surfaceMaterial(surface.texture), url = material?.maps.color;
    let texture: string | undefined;
    if (url?.startsWith('/materials/') && !url.includes('..')) {
      const file = path.join(process.cwd(), 'public', url);
      // Fallar antes de generar si el material registrado falta: no reemplazarlo silenciosamente por otro terreno.
      const resized = await sharp(file).resize(256, 256, { fit: 'fill' }).png().toBuffer();
      texture = (await sharp(resized).composite([{ input: { create: { width: 256, height: 256, channels: 3,
        background: color(surface.color, '#ffffff') } }, blend: 'multiply' }]).jpeg({ quality: 85 }).toBuffer()).toString('base64');
    }
    const id = `terrain-${index}`, tile = Math.max(50, surface.tileSizeMm);
    const pattern = texture ? `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}" patternTransform="rotate(${surface.rotation})"><image href="data:image/jpeg;base64,${texture}" width="${tile}" height="${tile}" preserveAspectRatio="none"/></pattern></defs>` : '';
    const shape = surface.footprint ? `<polygon points="${points(surface.footprint)}"`
      : `<rect x="${surface.x}" y="${surface.y}" width="${surface.widthMm}" height="${surface.depthMm}"`;
    return `${pattern}${shape} fill="${texture ? `url(#${id})` : color(surface.color, '#e4e1d9')}"/>`;
  }));
  // Un terreno puede abarcar la casa: sus suelos interiores siguen tapándolo como en el editor.
  const floors = terrain.length ? deriveRoomsSafe(doc).filter(room => !exteriorFloors.some(surface => surface.id === `floor:${room.id}`))
    .filter(room => room.wallIds.some(id =>
    doc.walls.some(wall => wall.id === id && !wall.hidden && !wall.id.startsWith('outdoor:'))))
    .map(room => `<polygon points="${points(room.boundary)}" fill="#fbfaf7"/>`).join('') : '';
  return layers.slice(0, terrain.length).join('') + floors + layers.slice(terrain.length).join('');
}
