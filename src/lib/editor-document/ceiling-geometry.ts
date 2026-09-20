import { planObjects } from '@/lib/editor-document/boundary-types';
import type { Ceiling, EditorDocument, Luminaire, Point } from './schema';
import { deriveRooms, type DerivedRoom } from './rooms';
import { wallConstruction } from './construction-properties';
import { floorFinish } from './floor-finishes';
import { furnitureSpatial } from './spatial-properties';

export interface CeilingSurface { ceiling: Ceiling; room: DerivedRoom; heightMm: number; }
export interface ResolvedLuminaire {
  luminaire: Luminaire; ceiling: Ceiling; heightMm: number; ceilingHeightMm: number;
}
/** Un recinto lógico exterior no implica una cubierta. Las paredes ocultadas a mano siguen siendo interiores. */
export function eligibleCeilingRooms(doc: EditorDocument): DerivedRoom[] {
  if (doc.designSpaceKind && doc.designSpaceKind !== 'interior') return [];
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
    return heightMm - (floorFinish(doc, room.id).elevationMm ?? 0) < 2100 ? [] : [{ ceiling, room, heightMm }];
  });
}
export const luminaireRadiusMm = (kind: Luminaire['kind']) => kind === 'pendant' ? 180 : kind === 'flush' ? 160 : 50;
export const luminaireDepthMm = (kind: Luminaire['kind']) => kind === 'pendant' ? 220 : kind === 'flush' ? 100 : 10;

/** Error visible al perder el soporte o invadir el espacio útil; nunca reposiciona silenciosamente. */
export function luminairePlacementIssue(doc: EditorDocument, light: Luminaire, surfaces = ceilingSurfaces(doc)): string | null {
  const surface = surfaces.find((item) => item.ceiling.id === light.ceilingId);
  if (!surface) return 'El techo requiere revisar su estancia o altura';
  const { ceiling, room, heightMm } = surface;
  if (light.kind === 'recessed' && (ceiling.kind !== 'suspended' || ceiling.dropMm < 80)) return 'El foco empotrado necesita un falso techo con al menos 8 cm';
  const radius = luminaireRadiusMm(light.kind);
  const halfWall = Math.max(...doc.walls.filter((wall) => room.wallIds.includes(wall.id)).map((wall) => wall.thicknessMm / 2), 0);
  if (!insideRoom(light, room.boundary) || boundaryClearance(light, room.boundary) < radius + halfWall + 20)
    return 'La luminaria debe quedar dentro de la estancia, separada de los muros';
  const bottom = heightMm - light.dropMm - luminaireDepthMm(light.kind);
  const floor = floorFinish(doc, room.id).elevationMm ?? 0;
  if (bottom - floor < 2100) return 'Conserva al menos 2,10 m de altura libre bajo la luminaria';
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
      Math.hypot(other.x - light.x, other.y - light.y) < radius + luminaireRadiusMm(other.kind) + 50)
      return 'Separa las luminarias para que no se superpongan';
  }
  return null;
}
export function resolvedLuminaires(doc: EditorDocument): ResolvedLuminaire[] {
  const surfaces = ceilingSurfaces(doc);
  return (doc.luminaires ?? []).flatMap((luminaire) => {
    const surface = surfaces.find((item) => item.ceiling.id === luminaire.ceilingId);
    if (!surface || luminairePlacementIssue(doc, luminaire, surfaces)) return [];
    return [{ luminaire, ceiling: surface.ceiling, heightMm: surface.heightMm - luminaire.dropMm - luminaireDepthMm(luminaire.kind), ceilingHeightMm: surface.heightMm }];
  });
}
/** Aviso de construcción con el elemento al que apunta, para poder seleccionarlo desde la notificación. */
export interface CeilingIssue { id?: string; label: string; message: string }

const LIGHT_KIND_LABEL = { pendant: 'Lámpara colgante', flush: 'Plafón', recessed: 'Foco empotrado' } as const;

export function ceilingIssues(doc: EditorDocument): CeilingIssue[] {
  if (!doc.ceilings?.length) return [];
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
      const issue = luminairePlacementIssue(doc, light, surfaces);
      return issue ? [{ id: light.id, label: `${LIGHT_KIND_LABEL[light.kind]} ${index + 1}`, message: issue }] : [];
    }),
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
