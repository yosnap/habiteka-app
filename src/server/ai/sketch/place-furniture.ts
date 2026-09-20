/**
 * Colocación del MOBILIARIO dibujado en el plano: cada caja que el modelo de
 * visión reconoció (coordenadas de imagen 0–1) se proyecta a milímetros, se
 * empareja con la entrada del catálogo interno que mejor casa por tipo,
 * estancia y tamaño, y se coloca centrada en la caja con su giro. Un mueble
 * que cae fuera de toda estancia, o que se sale de la suya más de lo tolerable,
 * se descarta con aviso: mejor ausente que atravesando un muro. Puro y sin IA.
 */
import type { ImportedFurniture, PlanImportWarning, PlanZone } from '@/lib/contracts';
import {
  FURNITURE_CATALOG,
  normalizeFurnitureSearch,
  type FurnitureCatalogEntry,
  type FurnitureProfile,
  type FurnitureRoom,
} from '@/lib/editor-document/furniture-catalog';
import type { SketchFurniture } from './sketch-types';

export interface PlacementScale {
  mmPerUnitX: number;
  mmPerUnitY: number;
}

export interface PlacementResult {
  furniture: ImportedFurniture[];
  warnings: PlanImportWarning[];
}

// Fracción del tamaño del mueble que puede salirse de su estancia y aun así
// recolocarse dentro (imprecisión de la caja leída); más, se descarta.
const MAX_SPILL_RATIO = 0.25;

// Estancia del catálogo a partir del nombre rotulado en el plano.
const ROOM_KEYWORDS: Array<[FurnitureRoom, string[]]> = [
  ['dormitorio', ['dorm', 'habitacion', 'bedroom']],
  ['cocina', ['cocina', 'kitchen', 'despensa', 'lavanderia', 'lavadero']],
  ['bano', ['bano', 'aseo', 'wc', 'lavabo', 'b°', 'bº']],
  ['comedor', ['comedor', 'dining']],
  ['salon', ['salon', 'sala', 'living', 'estar', 'recibidor', 'hall', 'pasillo', 'vestidor', 'entrada']],
  ['oficina', ['estudio', 'oficina', 'despacho', 'office']],
  ['exterior', ['terraza', 'patio', 'jardin', 'porche', 'loggia', 'balcon', 'garden', 'cochera', 'garaje']],
];

/** Estancia del catálogo que sugiere un nombre de zona; null si no se reconoce. */
export function roomFromZoneName(name: string): FurnitureRoom | null {
  const normalized = normalizeFurnitureSearch(name);
  for (const [room, keywords] of ROOM_KEYWORDS) {
    if (keywords.some((k) => normalized.includes(normalizeFurnitureSearch(k)))) return room;
  }
  return null;
}

/** Proyecta las cajas leídas a mm, elige entrada de catálogo y valida la estancia. */
export function placeFurniture(
  items: SketchFurniture[],
  scale: PlacementScale,
  zones: PlanZone[],
): PlacementResult {
  const furniture: ImportedFurniture[] = [];
  const warnings: PlanImportWarning[] = [];
  const boxes = zones
    .filter((z) => z.outline.length >= 3)
    .map((z) => ({ zone: z, ...bounds(z.outline) }));

  items.forEach((item, index) => {
    const box = {
      minX: item.bbox.minX * scale.mmPerUnitX,
      maxX: item.bbox.maxX * scale.mmPerUnitX,
      minY: item.bbox.minY * scale.mmPerUnitY,
      maxY: item.bbox.maxY * scale.mmPerUnitY,
    };
    let center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
    const drawn = { w: box.maxX - box.minX, h: box.maxY - box.minY };

    const host = boxes.find((b) => contains(b, center));
    if (!host) {
      warnings.push({
        code: 'mueble-fuera-de-estancia',
        message: `${item.tipo}${item.etiqueta ? ` («${item.etiqueta}»)` : ''} dibujado fuera de toda estancia; no se coloca.`,
      });
      return;
    }

    const entry = bestCatalogEntry(item, drawn, roomFromZoneName(host.zone.name));
    if (!entry) {
      warnings.push({
        code: 'mueble-sin-catalogo',
        zoneId: host.zone.id,
        message: `No hay pieza de catálogo para «${item.tipo}» en «${host.zone.name}».`,
      });
      return;
    }

    // Huella en planta según el giro (el catálogo define ancho × fondo sin girar).
    const rotated = item.rotacionDeg === 90 || item.rotacionDeg === 270;
    const footprint = rotated ? { w: entry.depthMm, h: entry.widthMm } : { w: entry.widthMm, h: entry.depthMm };
    const spillX = Math.max(0, host.minX - (center.x - footprint.w / 2), center.x + footprint.w / 2 - host.maxX);
    const spillY = Math.max(0, host.minY - (center.y - footprint.h / 2), center.y + footprint.h / 2 - host.maxY);
    if (spillX > footprint.w * MAX_SPILL_RATIO || spillY > footprint.h * MAX_SPILL_RATIO) {
      warnings.push({
        code: 'mueble-fuera-de-estancia',
        zoneId: host.zone.id,
        message: `«${entry.label}» no cabe en «${host.zone.name}» donde está dibujado; no se coloca.`,
      });
      return;
    }
    // Pequeño desbordamiento: se recoloca pegado al muro, nunca atravesándolo.
    center = {
      x: clamp(center.x, host.minX + footprint.w / 2, host.maxX - footprint.w / 2),
      y: clamp(center.y, host.minY + footprint.h / 2, host.maxY - footprint.h / 2),
    };

    furniture.push({
      id: `f${index}`,
      catalogId: entry.id,
      kind: entry.kind,
      label: entry.label,
      x: Math.round(center.x),
      y: Math.round(center.y),
      widthMm: entry.widthMm,
      depthMm: entry.depthMm,
      rotation: item.rotacionDeg,
      zoneId: host.zone.id,
    });
  });

  return { furniture, warnings };
}

/**
 * Mejor entrada del catálogo: mismo perfil, preferencia por la estancia del
 * plano y, entre candidatas, la de tamaño más parecido a la caja dibujada
 * (distancia logarítmica en ancho y fondo, con el giro aplicado).
 */
function bestCatalogEntry(
  item: SketchFurniture,
  drawn: { w: number; h: number },
  room: FurnitureRoom | null,
): FurnitureCatalogEntry | null {
  const profile = item.tipo as FurnitureProfile;
  const byProfile = FURNITURE_CATALOG.filter((e) => e.profile === profile);
  if (byProfile.length === 0) return null;
  const preferred = room ? byProfile.filter((e) => e.room === room) : [];
  const candidates = preferred.length > 0 ? preferred : byProfile;
  const rotated = item.rotacionDeg === 90 || item.rotacionDeg === 270;
  const target = rotated ? { w: drawn.h, h: drawn.w } : drawn;
  let best: FurnitureCatalogEntry | null = null;
  let bestScore = Infinity;
  for (const e of candidates) {
    const score =
      Math.abs(Math.log(Math.max(1, target.w) / e.widthMm)) +
      Math.abs(Math.log(Math.max(1, target.h) / e.depthMm));
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function bounds(points: Array<{ x: number; y: number }>): Box {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

function contains(b: Box, p: { x: number; y: number }): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}

function clamp(v: number, min: number, max: number): number {
  return min > max ? (min + max) / 2 : Math.min(Math.max(v, min), max);
}
