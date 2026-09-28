import { planObjects } from '@/lib/editor-document/boundary-types';
import type { Ceiling, EditorDocument, Luminaire, Point } from './schema';
import { deriveRooms, type DerivedRoom } from './rooms';
import { wallConstruction } from './construction-properties';
import { floorFinish } from './floor-finishes';
import { furnitureSpatial } from './spatial-properties';
// Ciclo de módulos tolerado: solo se usa dentro de funciones, nunca al cargar.
import { lightStripIssues } from './light-strip-geometry';
import { activeSceneForRoom, effectiveLuminaire } from './lighting-scene';

/** Altura libre mínima bajo techo y luminarias; un solo sitio para geometría, comandos y mensajes. */
export const MIN_FREE_HEIGHT_MM = 2100;
export const DEFAULT_ROOF_THICKNESS_MM = 160;

export interface CeilingSurface { ceiling: Ceiling; room: DerivedRoom; heightMm: number; }
export interface ResolvedLuminaire {
  luminaire: Luminaire; ceiling: Ceiling; heightMm: number; ceilingHeightMm: number;
  /** Estancia de la luminaria: determina qué escena de iluminación la afecta. */
  roomId: string;
  /**
   * Valores que mandan en 2D, 3D e IA: los nominales de la luminaria, o los de
   * la escena activa de su estancia. Los campos de `luminaire` no cambian.
   */
  effectiveTemperatureK: number;
  effectiveLumens: number;
  effectiveEnabled: boolean;
  /** Cota del suelo acabado de la estancia: base del alcance inclinado del foco. */
  floorElevationMm: number;
  /** Punto del suelo al que apunta el foco orientable; ausente en el resto de tipos. */
  aim?: Point;
}
/** Un recinto lógico exterior no implica una cubierta. Las paredes ocultadas a mano siguen siendo interiores. */
export function eligibleCeilingRooms(doc: EditorDocument): DerivedRoom[] {
  // El tipo de captura puede ser «entrada» o «fachada» para un inmueble mixto.
  // Los techos ya colocados prueban que hay interiores y no deben desaparecer.
  if (doc.designSpaceKind && doc.designSpaceKind !== 'interior' && !doc.ceilings?.length) return [];
  return deriveRooms(doc).filter((room) =>
    !room.wallIds.some((id) => doc.walls.some((wall) => wall.id === id && wall.hidden && (id.startsWith('hidden:') || id.startsWith('outdoor:')))) &&
    !doc.labels.some((label) => /\b(patio|terraza|jard[ií]n|balc[oó]n|exterior|porche|loggia)\b/i.test(label.text) && insideRoom(label, room.boundary)));
}
export function ceilingSurfaces(doc: EditorDocument): CeilingSurface[] {
  if (!doc.ceilings?.length) return [];
  let rooms: DerivedRoom[];
  try { rooms = eligibleCeilingRooms(doc); } catch { return []; }
  return doc.ceilings.flatMap((ceiling) => {
    const room = rooms.find((item) => item.id === ceiling.roomId);
    if (!room) return [];
    const wallTops = doc.walls.filter((wall) => room.wallIds.includes(wall.id) && !wall.hidden)
      .map((wall) => (wall.baseElevationMm ?? 0) + wallConstruction(wall).heightMm);
    const levelHeight = doc.levels?.find((level) => level.id === doc.activeLevelId)?.heightMm ?? Infinity;
    const top = Math.min(levelHeight, ...(wallTops.length ? wallTops : [2700]));
    const heightMm = top - ceiling.dropMm;
    return heightMm - (floorFinish(doc, room.id).elevationMm ?? 0) < MIN_FREE_HEIGHT_MM ? [] : [{ ceiling, room, heightMm }];
  });
}
/** La vista exterior terminada solo puede ocultar el interior si todas sus estancias tienen cubierta válida. */
export function hasCompleteInteriorRoof(doc: EditorDocument): boolean {
  try {
    const rooms = eligibleCeilingRooms(doc);
    const covered = new Set(ceilingSurfaces(doc).map((surface) => surface.room.id));
    return rooms.length > 0 && rooms.every((room) => covered.has(room.id));
  } catch { return false; }
}
export const luminaireRadiusMm = (kind: Luminaire['kind'], mount?: Luminaire['mount']) =>
  kind === 'pendant' ? 180 : kind === 'flush' ? 160 : kind === 'spot' ? (mount === 'recessed' ? 60 : 90) : 50;
export const luminaireDepthMm = (kind: Luminaire['kind'], mount?: Luminaire['mount']) =>
  kind === 'pendant' ? 220 : kind === 'flush' ? 100 : kind === 'spot' ? (mount === 'recessed' ? 12 : 110) : 10;

/** Ángulo del haz de acento del foco orientable, constante en 2D, 3D e IA. */
export const SPOT_CONE_DEG = 30;

/**
 * Dirección del haz en ejes del plano (x hacia la derecha, y hacia abajo) más
 * su componente vertical `down`. Un solo cálculo para el símbolo 2D, el
 * `target` de la escena 3D y el contexto de diseño IA.
 */
export function spotAimVector(light: Luminaire): { x: number; y: number; down: number } {
  if (light.kind !== 'spot') return { x: 0, y: 0, down: 1 };
  const tilt = (light.tiltDeg ?? 0) * Math.PI / 180, azimuth = (light.azimuthDeg ?? 0) * Math.PI / 180;
  return { x: Math.sin(tilt) * Math.cos(azimuth), y: Math.sin(tilt) * Math.sin(azimuth), down: Math.cos(tilt) };
}

/** Punto del suelo al que apunta el foco; con inclinación 0 coincide con su posición. */
export function spotAimPoint(resolved: Pick<ResolvedLuminaire, 'luminaire' | 'heightMm' | 'floorElevationMm'>): Point {
  const { luminaire, heightMm, floorElevationMm } = resolved;
  const direction = spotAimVector(luminaire);
  if (luminaire.kind !== 'spot' || !direction.down) return { x: luminaire.x, y: luminaire.y };
  const clearance = Math.max(0, heightMm - floorElevationMm);
  const reach = clearance * (Math.hypot(direction.x, direction.y) / direction.down);
  const length = Math.hypot(direction.x, direction.y) || 1;
  return { x: luminaire.x + reach * direction.x / length, y: luminaire.y + reach * direction.y / length };
}

/** Error visible al perder el soporte o invadir el espacio útil; nunca reposiciona silenciosamente. */
export function luminairePlacementIssue(doc: EditorDocument, light: Luminaire, surfaces = ceilingSurfaces(doc)): string | null {
  const surface = surfaces.find((item) => item.ceiling.id === light.ceilingId);
  if (!surface) return 'El techo requiere revisar su estancia o altura';
  const { ceiling, room, heightMm } = surface;
  if (needsSuspendedCeiling(light) && (ceiling.kind !== 'suspended' || ceiling.dropMm < 80)) return 'El foco empotrado necesita un falso techo con al menos 8 cm';
  const radius = luminaireRadiusMm(light.kind, light.mount);
  const halfWall = Math.max(...doc.walls.filter((wall) => room.wallIds.includes(wall.id)).map((wall) => wall.thicknessMm / 2), 0);
  if (!insideRoom(light, room.boundary) || boundaryClearance(light, room.boundary) < radius + halfWall + 20)
    return 'La luminaria debe quedar dentro de la estancia, separada de los muros';
  const bottom = heightMm - light.dropMm - luminaireDepthMm(light.kind, light.mount);
  const floor = floorFinish(doc, room.id).elevationMm ?? 0;
  if (bottom - floor < MIN_FREE_HEIGHT_MM) return 'Conserva al menos 2,10 m de altura libre bajo la luminaria';
  const objects = [...planObjects(doc).map((item) => ({ ...item, ...furnitureSpatial(item) })), ...(doc.columns ?? []), ...(doc.stairs ?? []),
    ...(doc.ramps ?? []).map((item) => ({ ...item, heightMm: item.riseMm + (item.route?.secondRiseMm ?? 0) }))];
  for (const item of objects) {
    const angle = -item.rotation * Math.PI / 180, dx = light.x - item.x, dy = light.y - item.y;
    const x = dx * Math.cos(angle) - dy * Math.sin(angle), y = dx * Math.sin(angle) + dy * Math.cos(angle);
    if (x >= -radius && x <= item.widthMm + radius && y >= -radius && y <= item.depthMm + radius &&
      (item.elevationMm ?? 0) + item.heightMm + 100 > bottom) return 'La luminaria invade un elemento alto o una zona de circulación elevada';
  }
  for (const other of doc.luminaires ?? []) {
    if (other.id !== light.id && other.ceilingId === light.ceilingId &&
      Math.hypot(other.x - light.x, other.y - light.y) < radius + luminaireRadiusMm(other.kind, other.mount) + 50)
      return 'Separa las luminarias para que no se superpongan';
  }
  return null;
}
/** El foco empotrado y el orientable con montaje empotrado piden falso techo. */
export const needsSuspendedCeiling = (light: Pick<Luminaire, 'kind' | 'mount'>) =>
  light.kind === 'recessed' || (light.kind === 'spot' && light.mount === 'recessed');

export function resolvedLuminaires(doc: EditorDocument): ResolvedLuminaire[] {
  const surfaces = ceilingSurfaces(doc);
  return (doc.luminaires ?? []).flatMap((luminaire) => {
    const surface = surfaces.find((item) => item.ceiling.id === luminaire.ceilingId);
    if (!surface || luminairePlacementIssue(doc, luminaire, surfaces)) return [];
    const effective = effectiveLuminaire(luminaire, activeSceneForRoom(doc, surface.room.id));
    const base = { luminaire, ceiling: surface.ceiling, roomId: surface.room.id,
      effectiveTemperatureK: effective.temperatureK, effectiveLumens: effective.lumens, effectiveEnabled: effective.enabled,
      heightMm: surface.heightMm - luminaire.dropMm - luminaireDepthMm(luminaire.kind, luminaire.mount),
      ceilingHeightMm: surface.heightMm, floorElevationMm: floorFinish(doc, surface.room.id).elevationMm ?? 0 };
    return [luminaire.kind === 'spot' ? { ...base, aim: spotAimPoint(base) } : base];
  });
}

/**
 * Aviso (nunca bloqueo) cuando el haz inclinado cae fuera de la estancia: un
 * foco que lava un muro medianero es legítimo, uno que apunta al vacío no.
 */
export function spotAimIssue(doc: EditorDocument, light: Luminaire, surfaces = ceilingSurfaces(doc)): string | null {
  if (light.kind !== 'spot' || !light.tiltDeg) return null;
  const surface = surfaces.find((item) => item.ceiling.id === light.ceilingId);
  if (!surface) return null;
  const aim = spotAimPoint({ luminaire: light,
    heightMm: surface.heightMm - light.dropMm - luminaireDepthMm(light.kind, light.mount),
    floorElevationMm: floorFinish(doc, surface.room.id).elevationMm ?? 0 });
  if (insideRoom(aim, surface.room.boundary)) return null;
  const thickness = Math.max(...doc.walls.filter((wall) => surface.room.wallIds.includes(wall.id)).map((wall) => wall.thicknessMm), 0);
  return boundaryClearance(aim, surface.room.boundary) <= thickness
    ? null : 'el haz inclinado cae fuera de la estancia: reduce la inclinación o gira el foco';
}
/** Aviso de construcción con el elemento al que apunta, para poder seleccionarlo desde la notificación. */
export interface CeilingIssue { id?: string; label: string; message: string }

const LIGHT_KIND_LABEL = { pendant: 'Lámpara colgante', flush: 'Plafón', recessed: 'Foco empotrado', spot: 'Foco orientable' } as const;

export function ceilingIssues(doc: EditorDocument): CeilingIssue[] {
  if (!doc.ceilings?.length) return doc.lightStrips?.length ? lightStripIssues(doc) : [];
  let surfaces: CeilingSurface[];
  try { surfaces = ceilingSurfaces(doc); }
  catch { return [{ label: 'Techos', message: 'requieren revisar el cierre de las habitaciones' }]; }
  const roomName = (roomId: string) => {
    try { const room = deriveRooms(doc).find((r) => r.id === roomId); return room ? doc.labels.find((label) => insideRoom(label, room.boundary))?.text : undefined; }
    catch { return undefined; }
  };
  return [
    ...doc.ceilings.filter((ceiling) => !surfaces.some((surface) => surface.ceiling.id === ceiling.id))
      .map((ceiling, index) => ({ id: ceiling.id, label: `Techo de ${roomName(ceiling.roomId) ?? `estancia ${index + 1}`}`, message: 'revisa la estancia o la altura libre (mínimo 2,10 m)' })),
    ...(doc.luminaires ?? []).flatMap((light, index) => {
      const issue = luminairePlacementIssue(doc, light, surfaces) ?? spotAimIssue(doc, light, surfaces);
      return issue ? [{ id: light.id, label: `${LIGHT_KIND_LABEL[light.kind]} ${index + 1}`, message: issue }] : [];
    }),
    // Las tiras LED avisan por el mismo canal que las luminarias.
    ...lightStripIssues(doc),
  ];
}

/** Versión en texto de `ceilingIssues`, para paneles que solo listan avisos. */
export function ceilingWarnings(doc: EditorDocument): string[] {
  return ceilingIssues(doc).map((issue) => `${issue.label}: ${issue.message}.`);
}
export function insideRoom(p: Point, boundary: Point[]): boolean {
  let result = false;
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const a = boundary[i]!, b = boundary[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
export function boundaryClearance(point: Point, boundary: Point[]): number {
  return Math.min(...boundary.map((a, i) => {
    const b = boundary[(i + 1) % boundary.length]!;
    const length2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / (length2 || 1)));
    return Math.hypot(point.x - a.x - (b.x - a.x) * t, point.y - a.y - (b.y - a.y) * t);
  }));
}
