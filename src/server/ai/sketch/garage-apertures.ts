/**
 * Puerta de garaje reconocida por su sitio: un hueco ancho en la fachada de una estancia rotulada garaje, cochera o
 * parking es la puerta del coche aunque la lectura no la distinga. Se marca como variante «garaje» antes de anclar las
 * aberturas, para que su ancho no se recorte al de un paso normal. Puro y sin IA.
 */
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { GARAGE_DOOR_MIN_MM, GARAGE_ROOM_NAME } from '@/lib/editor-document/imported-opening-types';
import type { Scale } from './normalize-geometry';
import type { RawSketch, SketchAperture } from './sketch-types';
/** Distancia a cada lado del eje del muro a la que se mira qué estancia hay (más que medio muro grueso). */
const PROBE_MM = 300;

type Point = { x: number; y: number };

/** La abertura está en la fachada de un garaje: a un lado el garaje y al otro ninguna estancia interior. */
function onGarageFacade(raw: RawSketch, aperture: SketchAperture, scale: Scale): boolean {
  const wall = raw.muros[aperture.muro];
  if (!wall) return false;
  const dxMm = (wall.x2 - wall.x1) * scale.mmPerUnitX, dyMm = (wall.y2 - wall.y1) * scale.mmPerUnitY, lengthMm = Math.hypot(dxMm, dyMm);
  if (!(lengthMm > 0) || (aperture.anchoSobreMuro ?? 0) * lengthMm < GARAGE_DOOR_MIN_MM) return false;
  const center = { x: wall.x1 + (wall.x2 - wall.x1) * aperture.posicion, y: wall.y1 + (wall.y2 - wall.y1) * aperture.posicion };
  const probe = (sign: number): Point => ({ x: center.x - sign * dyMm / lengthMm * PROBE_MM / scale.mmPerUnitX,
    y: center.y + sign * dxMm / lengthMm * PROBE_MM / scale.mmPerUnitY });
  const rooms = raw.habitaciones.filter((room) => room.poligono.length >= 3);
  const garage = (point: Point) => rooms.some((room) => GARAGE_ROOM_NAME.test(room.nombre) && pointInPolygon(point, room.poligono));
  const indoor = (point: Point) => rooms.some((room) => room.exterior !== true && !GARAGE_ROOM_NAME.test(room.nombre) && pointInPolygon(point, room.poligono));
  const [left, right] = [probe(1), probe(-1)];
  return (garage(left) && !garage(right) && !indoor(right)) || (garage(right) && !garage(left) && !indoor(left));
}

/**
 * Marca como puerta de garaje cada hueco o puerta sin variante de 2,2 m o más en la fachada de un garaje. Devuelve el
 * mismo boceto si no hay ninguno, para no repetir trabajo.
 */
export function markGarageDoors(raw: RawSketch, scale: Scale): RawSketch {
  if (!raw.habitaciones.some((room) => GARAGE_ROOM_NAME.test(room.nombre))) return raw;
  let changed = false;
  const aberturas = raw.aberturas.map((aperture) => {
    if (aperture.tipo === 'ventana' || aperture.variante || !onGarageFacade(raw, aperture, scale)) return aperture;
    changed = true;
    return { ...aperture, tipo: 'puerta' as const, variante: 'garaje' as const };
  });
  return changed ? { ...raw, aberturas } : raw;
}
