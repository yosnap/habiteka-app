/**
 * Cámaras de interiorismo: una por estancia, a altura de ojos y dentro de la
 * estancia.
 *
 * Existe porque un modelo de imagen no sabe inventar una perspectiva fiel desde
 * un plano en planta: hay que darle una captura del 3D real tomada como la
 * tomaría un fotógrafo de interiores (ojo a 1,6 m sobre el suelo ACABADO de la
 * estancia, separado de los muros y de las puertas, en el punto que más metros
 * deja por delante, mirando al centro). Así el modelo solo pone materiales, luz
 * y muebles sobre una geometría que ya es correcta.
 *
 * Todo lo de aquí es puro: mismas entradas, misma pose, sin tocar la escena.
 */
import { cameraPoseSchema, type CameraPose } from '@/lib/contracts/walkthrough-keyframe';
import { boundaryClearance, insideRoom } from './ceiling-geometry';
import { floorFinish } from './floor-finishes';
import { distance, interpolate, wallPoints } from './geometry';
import { deriveRoomsSafe, type DerivedRoom } from './rooms';
import type { EditorDocument, Point } from './schema';

/** Altura del ojo sobre el suelo acabado, en milímetros (fotografía de interiores). */
export const EYE_HEIGHT_MM = 1600;
/** El punto de mira baja un poco respecto al ojo: encuadre natural, no de techo. */
const FOCUS_DROP_MM = 200;
/** Campo de visión de una estancia amplia: un 24 mm en formato completo. */
export const INTERIOR_FOV_DEG = 65;
/** Campo de visión máximo, para estancias pequeñas donde 65° no cabe. */
export const INTERIOR_FOV_MAX_DEG = 85;
/** A partir de esta superficie el encuadre ya no necesita abrir el ángulo. */
const WIDE_ROOM_M2 = 20;
/** Por debajo de esta superficie el ángulo se abre hasta el máximo. */
const TIGHT_ROOM_M2 = 6;
/** Separación mínima respecto a los muros para que no dominen el encuadre. */
const MIN_CLEARANCE_MM = 450;
/** Distancia mínima a una puerta: ni dentro del vano ni pegado a su marco. */
const MIN_DOOR_CLEARANCE_MM = 1000;
/** Retracciones probadas desde cada candidato hacia el interior de la estancia. */
const RETRACTIONS_MM = [450, 700, 1000, 1400];
/**
 * Superficie por debajo de la cual nada es una estancia fotografiable: ni el
 * aseo más pequeño baja de aquí, así que es un hueco de instalaciones.
 */
const MIN_ROOM_MM2 = 1_500_000;
/**
 * Sin etiqueta no se sabe qué es, así que por debajo de esta superficie se
 * supone paso o hueco. Con etiqueta manda el nombre: un baño de 3,8 m² sí
 * interesa fotografiarlo.
 */
const UNNAMED_MIN_MM2 = 4_000_000;
/**
 * Nombres que describen un paso o un hueco de almacenaje: no se marcan por
 * defecto por grandes que sean, porque no son una estancia que amueblar.
 */
const PASSAGE_NAMES = [
  'pasillo',
  'distribuidor',
  'hall',
  'recibidor',
  'vestibulo',
  'armario',
  'trastero',
];

/** Comparación de nombres insensible a mayúsculas y acentos. */
function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Qué se marca por defecto en la lista de vistas interiores. El criterio es el
 * uso, no la superficie: baños, aseos y cocinas pequeñas son justo las
 * estancias que el usuario quiere ver renderizadas.
 */
export function isHabitableRoom(label: string | null, areaMm2: number): boolean {
  if (areaMm2 < MIN_ROOM_MM2) return false;
  if (!label) return areaMm2 >= UNNAMED_MIN_MM2;
  const name = normalizeName(label);
  return !PASSAGE_NAMES.some((passage) => name.includes(passage));
}

/**
 * Ángulo adaptativo: en un baño de 3 m² un 65° deja la cámara contra el lavabo;
 * en un salón de 40 m² un 85° deforma las líneas de fuga.
 */
export function interiorFovDeg(areaM2: number): number {
  const t = Math.max(0, Math.min(1, (areaM2 - TIGHT_ROOM_M2) / (WIDE_ROOM_M2 - TIGHT_ROOM_M2)));
  return Math.round(INTERIOR_FOV_MAX_DEG - t * (INTERIOR_FOV_MAX_DEG - INTERIOR_FOV_DEG));
}

export interface RoomInteriorCamera {
  roomId: string;
  /** Etiqueta del plano si la hay; si no, «Estancia N». */
  name: string;
  areaM2: number;
  /** Falso para pasos y huecos (pasillos, armarios, restos sin nombre): no se marcan por defecto. */
  habitable: boolean;
  camera: CameraPose;
}

/**
 * Una cámara interior por estancia cerrada del documento activo. Un plano con
 * contornos en conflicto devuelve una lista vacía en vez de romper el editor
 * (`deriveRoomsSafe`), igual que hace el resto del editor.
 */
export function roomInteriorCameras(doc: EditorDocument): RoomInteriorCamera[] {
  return deriveRoomsSafe(doc).map((room, index) => {
    const boundary = room.boundary;
    const centre = interiorPoint(boundary);
    const eye = eyePoint(doc, room, centre);
    const elevationMm = floorFinish(doc, room.id).elevationMm ?? 0;
    const eyeY = (elevationMm + EYE_HEIGHT_MM) / 1000;
    const camera = cameraPoseSchema.parse({
      position: [eye.x / 1000, eyeY, eye.y / 1000],
      focus: [centre.x / 1000, eyeY - FOCUS_DROP_MM / 1000, centre.y / 1000],
      fovDeg: interiorFovDeg(room.areaMm2 / 1_000_000),
      levelId: doc.activeLevelId ?? null,
    });
    const areaM2 = room.areaMm2 / 1_000_000;
    const label = roomLabel(doc, room);
    return {
      roomId: room.id,
      name: label ?? `Estancia ${index + 1}`,
      areaM2,
      habitable: isHabitableRoom(label, room.areaMm2),
      camera,
    };
  });
}

/**
 * Cámaras de las estancias elegidas, en el orden estable que devuelve
 * `roomInteriorCameras`. Ese orden es el contrato entre quien enseña la lista y
 * quien captura: si divergieran, las imágenes saldrían con el nombre cambiado.
 * Los ids que ya no existen en el plano se descartan.
 */
export function selectedInteriorCameras(
  cameras: RoomInteriorCamera[],
  roomIds: readonly string[],
): RoomInteriorCamera[] {
  return cameras.filter((camera) => roomIds.includes(camera.roomId));
}

/** Etiqueta del plano que cae dentro del contorno de la estancia, si la hay. */
function roomLabel(doc: EditorDocument, room: DerivedRoom): string | null {
  const label = doc.labels.find((item) => insideRoom(item, room.boundary));
  const text = label?.text.trim();
  return text ? text : null;
}

/**
 * Mejor punto de vista de la estancia. Se evalúan esquinas y puntos medios de
 * muro retraídos hacia el interior y gana el que más profundidad libre deja en
 * la dirección de mirada: así el encuadre enseña metros de estancia en vez de
 * un paño de pared o el marco de una puerta en primer plano.
 *
 * Los filtros (holgura a muro, distancia a puerta, estar dentro del polígono)
 * se relajan en cascada porque un aseo de 2 m² no admite 45 cm de separación a
 * todo; antes de quedarnos sin cámara, preferimos una peor.
 */
function eyePoint(doc: EditorDocument, room: DerivedRoom, centre: Point): Point {
  const boundary = room.boundary;
  const doors = doorPoints(doc, room);
  const candidates = placementCandidates(boundary, centre).filter((point) =>
    insideRoom(point, boundary),
  );
  const ranked = (minClearance: number, minDoor: number) =>
    candidates
      .filter(
        (point) =>
          boundaryClearance(point, boundary) >= minClearance &&
          doors.every((door) => distance(point, door) >= minDoor),
      )
      .sort((a, b) => visibleDepth(b, centre, boundary) - visibleDepth(a, centre, boundary))[0];
  // El centro siempre tiene la mayor holgura posible: sirve de listón cuando la
  // estancia es más estrecha que la separación deseada.
  const reachable = Math.min(MIN_CLEARANCE_MM, boundaryClearance(centre, boundary));
  return (
    ranked(MIN_CLEARANCE_MM, MIN_DOOR_CLEARANCE_MM) ??
    ranked(reachable, MIN_DOOR_CLEARANCE_MM) ??
    ranked(reachable, 0) ??
    centre
  );
}

/** Esquinas y puntos medios de muro, retraídos hacia el interior de la estancia. */
function placementCandidates(boundary: Point[], centre: Point): Point[] {
  const anchors = boundary.flatMap((a, index) => {
    const b = boundary[(index + 1) % boundary.length]!;
    return [a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }];
  });
  return anchors.flatMap((anchor) => {
    const span = distance(anchor, centre);
    if (span < 1) return [centre];
    return RETRACTIONS_MM.map((retraction) =>
      interpolate(anchor, centre, Math.min(1, retraction / span)),
    );
  });
}

/**
 * Metros de estancia por delante de la cámara: cuánto recorre el rayo que va
 * del ojo al punto interior antes de salir del polígono.
 */
function visibleDepth(eye: Point, centre: Point, boundary: Point[]): number {
  const span = distance(eye, centre);
  if (span < 1) return 0;
  const dx = (centre.x - eye.x) / span;
  const dy = (centre.y - eye.y) / span;
  let nearest = Infinity;
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i]!;
    const b = boundary[(i + 1) % boundary.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-9) continue;
    const t = ((a.x - eye.x) * ey - (a.y - eye.y) * ex) / denominator;
    const u = ((a.x - eye.x) * dy - (a.y - eye.y) * dx) / denominator;
    if (t > 1 && u >= 0 && u <= 1 && t < nearest) nearest = t;
  }
  return Number.isFinite(nearest) ? nearest : 0;
}

/**
 * Centro de cada puerta de la estancia. La cámara se aparta de todas ellas: un
 * vano a menos de un metro llena el encuadre con su marco.
 */
function doorPoints(doc: EditorDocument, room: DerivedRoom): Point[] {
  return doc.openings.flatMap((opening) => {
    if (opening.kind !== 'puerta' || !room.wallIds.includes(opening.wallId)) return [];
    const wall = doc.walls.find((candidate) => candidate.id === opening.wallId);
    if (!wall) return [];
    const [a, b] = wallPoints(doc, wall);
    return [interpolate(a, b, Math.max(0, Math.min(1, opening.position)))];
  });
}

/**
 * Punto interior de un polígono simple: el centroide si cae dentro; si no, el
 * centro del primer triángulo de vértices consecutivos que sí lo hace (planta
 * en L, U o con entrantes).
 */
function interiorPoint(polygon: Point[]): Point {
  const centroid = {
    x: polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length,
    y: polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length,
  };
  if (insideRoom(centroid, polygon)) return centroid;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const c = polygon[(i + 2) % polygon.length]!;
    const p = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    if (insideRoom(p, polygon)) return p;
  }
  return centroid;
}
