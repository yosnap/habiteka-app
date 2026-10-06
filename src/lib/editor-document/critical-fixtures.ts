import type { EditorDocument, Furniture, Point } from './schema';
import { getFurnitureCatalogEntry } from './furniture-catalog';
import { localToWorld, objectCenter } from './spatial-properties';
import { deriveRoomsSafe } from './rooms';
import { pointInPolygon } from './polygon-tools';

export const FIXTURE_KINDS = ['toilet', 'washbasin', 'bidet', 'bath', 'shower', 'kitchen-sink', 'cooktop'] as const;
export type FixtureKind = typeof FIXTURE_KINDS[number];
export type FixtureCounts = Record<FixtureKind, number>;
export const FIXTURE_LABELS: Record<FixtureKind, string> = {
  toilet: 'inodoro', washbasin: 'lavabo', bidet: 'bidé', bath: 'bañera', shower: 'ducha',
  'kitchen-sink': 'fregadero', cooktop: 'placa de cocción / vitrocerámica',
};
export const emptyFixtureCounts = (): FixtureCounts => ({ toilet: 0, washbasin: 0, bidet: 0,
  bath: 0, shower: 0, 'kitchen-sink': 0, cooktop: 0 });

/** Identidad funcional real del catálogo: la pieza antigua llamada bidet es un contenedor, no un sanitario. */
export function criticalFixtureKind(item: Pick<Furniture, 'catalogId' | 'kind'>): FixtureKind | undefined {
  const entry = getFurnitureCatalogEntry(item.catalogId), profile = entry?.profile ?? item.kind;
  const identity = `${item.catalogId ?? ''} ${item.kind} ${entry?.label ?? ''}`.toLowerCase();
  if (/vitroceramica|vitrocerámica|cocina_electrica_horno|cocina.*fogones|cocina.*de pie.*horno/.test(identity)) return 'cooktop';
  if ((!entry || ['toilet', 'sink', 'bath'].includes(profile)) && /bid[eé]/.test(identity)) return 'bidet';
  if (profile === 'toilet' || (!entry && item.kind === 'inodoro')) return 'toilet';
  if (profile === 'sink' || (!entry && /^(lavabo|fregadero)$/.test(item.kind)))
    return entry?.room === 'cocina' || /fregadero/.test(identity) ? 'kitchen-sink' : 'washbasin';
  if (profile === 'bath' || (!entry && item.kind === 'banera')) return 'bath';
  if (profile === 'shower' || (!entry && item.kind === 'ducha')) return 'shower';
  return undefined;
}

export interface CriticalFixture {
  id: string; kind: FixtureKind; name: string; center: Point; widthMm: number; depthMm: number; rotationDeg: number;
}
export interface CriticalFixtureGroup {
  id: string; name: string; roomId?: string; counts: FixtureCounts; items: CriticalFixture[];
}

export function criticalFixtureGroups(doc: EditorDocument, prefix = ''): CriticalFixtureGroup[] {
  const rooms = deriveRoomsSafe(doc), groups = new Map<string, CriticalFixtureGroup>();
  const items: CriticalFixture[] = doc.furniture.flatMap(item => {
    const kind = criticalFixtureKind(item);
    return kind ? [{ id: item.id, kind, name: getFurnitureCatalogEntry(item.catalogId)?.label ?? FIXTURE_LABELS[kind],
      center: objectCenter(item), widthMm: item.widthMm, depthMm: item.depthMm, rotationDeg: item.rotation }] : [];
  });
  for (const run of doc.kitchenRuns ?? []) for (const slot of run.kitchen.slots) {
    const kind = slot.kind === 'vitroceramica' ? 'cooktop' : slot.kind === 'fregadero' ? 'kitchen-sink' : undefined;
    if (kind) items.push({ id: slot.id, kind, name: FIXTURE_LABELS[kind],
      center: localToWorld(run, { x: slot.positionMm, y: run.depthMm / 2 }),
      widthMm: slot.widthMm, depthMm: run.depthMm, rotationDeg: run.rotation });
  }
  for (const item of items) {
    const room = rooms.find(room => pointInPolygon(item.center, room.boundary));
    // Fuera de una estancia cerrada, no mezclar todos los sanitarios dispersos en un único baño ficticio.
    const key = room?.id ?? item.id;
    const group = groups.get(key) ?? { id: `${prefix}${key}`, roomId: room?.id,
      name: room ? doc.labels.find(label => pointInPolygon(label, room.boundary))?.text ?? 'Estancia sin rótulo'
        : item.name, counts: emptyFixtureCounts(), items: [] };
    group.counts[item.kind]++; group.items.push(item); groups.set(key, group);
  }
  return [...groups.values()];
}

export const CRITICAL_FIXTURE_RULE = 'SANITARIOS Y COCCIÓN: conserva el número y la función de cada pieza por estancia. Un inodoro, un lavabo y una ducha son tres elementos distintos, nunca tres inodoros. No dupliques sanitarios para decorar. Cada placa existente, independiente o integrada en encimera, debe verse como placa con sus zonas de cocción, sin objetos encima: no borrarla ni convertirla en encimera vacía. No añadas placas ni sanitarios donde el inventario marca cero. El rediseño autorizado de fijos permite sustituir bañera por ducha o viceversa, sin multiplicar las piezas. Una referencia aceptada adjunta fija los elementos y cantidades de ese diseño; respeta solo lo visible desde la cámara o máscara.';
