/**
 * Serializa el documento del canvas a una descripción textual para la IA.
 *
 * El lienzo lleva datos ESTRUCTURADOS (tipo, posición y tamaño de cada elemento).
 * En vez de volcar coordenadas en píxeles (que el modelo de imagen interpreta mal),
 * se traduce a una descripción SEMÁNTICA: contra qué pared está cada elemento, su
 * orientación y la proporción de la sala. Así el render respeta la disposición y no
 * confunde la vista cenital con una foto en perspectiva. Función pura (testeable).
 */
import type { CanvasDoc, StructObj } from './types';
import { CATALOG_BY_KIND } from './catalog';
import { isValidScale, pxToMeters, formatLength, formatObjectSize } from './scale';

/** Bounding box que envuelve un conjunto de objetos. */
interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsOf(objects: StructObj[]): Bounds {
  return {
    minX: Math.min(...objects.map((o) => o.x)),
    minY: Math.min(...objects.map((o) => o.y)),
    maxX: Math.max(...objects.map((o) => o.x + o.width)),
    maxY: Math.max(...objects.map((o) => o.y + o.height)),
  };
}

/** Posición semántica de un objeto dentro de la sala (rejilla 3×3). */
function positionLabel(o: StructObj, room: Bounds): string {
  const w = room.maxX - room.minX || 1;
  const h = room.maxY - room.minY || 1;
  const cx = (o.x + o.width / 2 - room.minX) / w; // 0..1 de izquierda a derecha
  const cy = (o.y + o.height / 2 - room.minY) / h; // 0..1 de arriba a abajo
  const band = (v: number, low: string, mid: string, high: string) =>
    v < 0.33 ? low : v > 0.67 ? high : mid;
  // En planta: "arriba" es la pared del fondo; "abajo", la pared frontal (cercana).
  const vert = band(cy, 'junto a la pared del fondo', 'en el centro', 'junto a la pared frontal');
  const horiz = band(cx, 'a la izquierda', '', 'a la derecha');
  return horiz ? `${vert}, ${horiz}` : vert;
}

/** Orientación del elemento según su proporción ancho/alto y su rotación. */
function orientationLabel(o: StructObj): string {
  const rotated = Math.round(o.rotation) % 180 !== 0;
  const longSideHorizontal = rotated ? o.height > o.width : o.width > o.height;
  if (Math.abs(o.width - o.height) < 8) return 'orientación cuadrada';
  return longSideHorizontal ? 'orientado en horizontal' : 'orientado en vertical';
}

export function serializeDocToPrompt(doc: CanvasDoc): string | null {
  if (doc.objects.length === 0) return null;

  // Si el plano tiene escala arquitectónica, las medidas reales (cm/m) enriquecen
  // la descripción. Sin escala, la salida es idéntica a la histórica (proporciones).
  const scale = isValidScale(doc.scale) ? doc.scale : null;

  // La sala la definen los muros; si no hay, el conjunto de todos los objetos.
  const walls = doc.objects.filter((o) => o.kind === 'wall');
  const room = boundsOf(walls.length ? walls : doc.objects);
  const roomW = Math.round(room.maxX - room.minX);
  const roomH = Math.round(room.maxY - room.minY);
  const ratio = roomH > 0 ? (roomW / roomH).toFixed(2) : '1';
  const shape =
    roomW > roomH * 1.2 ? 'apaisada (más ancha que profunda)' : roomH > roomW * 1.2 ? 'profunda (más larga que ancha)' : 'casi cuadrada';
  const roomSizeText = scale
    ? ` La sala mide aproximadamente ${formatLength(pxToMeters(roomW, scale))} de ancho por ${formatLength(pxToMeters(roomH, scale))} de profundidad.`
    : '';

  // Solo el mobiliario/estructura no-muro se describe como elemento colocado.
  const items = doc.objects.filter((o) => o.kind !== 'wall');
  const lines = items.map((o) => {
    const label = CATALOG_BY_KIND[o.kind]?.label ?? o.kind;
    const size = scale ? ` (${formatObjectSize(o, scale)})` : '';
    return `- ${label}${size}: ${positionLabel(o, room)}, ${orientationLabel(o)}.`;
  });

  return [
    'PLANO EN PLANTA (vista cenital, mirando la sala desde arriba). NO es una foto frontal:',
    `interpreta "pared del fondo" como la pared lejana y "pared frontal" como la cercana.`,
    `La sala es ${shape} (proporción ancho:alto ≈ ${ratio}:1). Genera el render con esa misma proporción.${roomSizeText}`,
    '',
    'Elementos y su ubicación contra las paredes:',
    ...lines,
    '',
    'Respeta ESTRICTAMENTE la proporción de la sala, la pared contra la que está cada',
    'elemento y su orientación. No reordenes, no rotes ni cambies de pared los elementos.',
  ].join('\n');
}
