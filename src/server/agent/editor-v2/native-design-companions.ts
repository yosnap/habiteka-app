/**
 * Conjuntos de la propuesta de Amueblar: la IA (o el boceto del cliente) elige el modelo de cada acompañante y el código
 * lo coloca junto a su pieza principal ya validada (sillas alrededor de la mesa, mesillas junto a la cama, taburetes a lo
 * largo de la barra, la alfombra bajo el sofá) y, encima de un acompañante, lo que a su vez lleva (la lámpara de cada
 * mesilla). Puro: solo valida contra el documento candidato.
 */
import { getFurnitureCatalogEntry, type FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { COMPANION_RULES, type CompanionRule } from '@/lib/editor-document/native-design-seating';
import { addSuggestedFurniture, nativeFurniturePlacementIssue, settleNativeDesignFurniture, type NativeDesignFurniture } from '@/lib/editor-document/native-design-proposal';
import { proposalSizeOnPlan } from '@/lib/editor-document/proposal-coordinates';
import type { deriveRooms } from '@/lib/editor-document/rooms';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { hasRoomTelevision } from '@/lib/editor-document/proposal-existing-television';

/** Modelo elegido para un acompañante y, en una alfombra dibujada, su medida en los ejes del plano. */
export interface CompanionPick { catalogId: string; sizeMm?: { x: number; y: number } }

export interface CompanionPlan {
  rules: readonly CompanionRule[];
  /** Estancias en las que cada regla tiene pieza principal: allí su acompañante lo coloca el código. */
  anchored: readonly ReadonlySet<string | undefined>[];
  /** Modelo pedido para cada regla y estancia (`índice:estancia`). */
  choice: ReadonlyMap<string, CompanionPick>;
}

/** Documento candidato y estancias donde se valida cada pieza, la estancia de la pieza principal y lo ya servido. */
export interface CompanionScene {
  doc: EditorDocument;
  rooms: ReturnType<typeof deriveRooms>;
  allowedRooms: ReadonlySet<string>;
  settleRooms: ReadonlySet<string>;
  zonePolygon?: Point[];
  home: string | undefined;
  plan: CompanionPlan;
  /** Conjuntos sin modelo por defecto ya puestos en una estancia: una alfombra no sale dos veces. */
  served: Set<string>;
}

const entryOf = (item: NativeDesignFurniture) => getFurnitureCatalogEntry(item.catalogId);

/**
 * Qué conjuntos hay en la propuesta, dónde y con qué modelo. Cuenta también la pieza que pone el propio código: la
 * mesilla de cada cama lleva su lámpara aunque la IA no pidiera mesillas.
 */
export function companionPlan(proposed: readonly { item: NativeDesignFurniture; room: string | undefined }[]): CompanionPlan {
  const present = proposed.map(({ item, room }) => {
    const entry = entryOf(item);
    const implied = COMPANION_RULES.flatMap((rule) => entry && rule.fallback && rule.anchor(entry) ? [getFurnitureCatalogEntry(rule.fallback(entry))] : []);
    return { room, entries: [entry, ...implied] };
  });
  const hasAnchor = (rule: CompanionRule, entries: (FurnitureCatalogEntry | undefined)[]) => entries.some((entry) => rule.anchor(entry));
  const rules = COMPANION_RULES.filter((rule) => present.some(({ entries }) => hasAnchor(rule, entries)));
  const anchored = rules.map((rule) => new Set(present.filter(({ entries }) => hasAnchor(rule, entries)).map(({ room }) => room)));
  const choice = new Map<string, CompanionPick>();
  for (const { item, room } of proposed) rules.forEach((rule, index) => {
    if (!room || !rule.companion(entryOf(item)) || choice.has(`${index}:${room}`)) return;
    const sizeMm = proposalSizeOnPlan(item);
    choice.set(`${index}:${room}`, { catalogId: item.catalogId, ...(sizeMm ? { sizeMm } : {}) });
  });
  return { rules, anchored, choice };
}

/** Acompañante que coloca el código junto a su pieza principal: no se valida donde lo puso la IA. */
export function placedByCompanion(plan: CompanionPlan, item: NativeDesignFurniture, room: string | undefined): boolean {
  return plan.rules.some((rule, index) => rule.companion(entryOf(item)) && plan.anchored[index]!.has(room));
}

interface CompanionGroup { rule: CompanionRule; key: string; chosen: CompanionPick; items: NativeDesignFurniture[] }

function companionGroups(scene: CompanionScene, anchor: NativeDesignFurniture, entry: FurnitureCatalogEntry): CompanionGroup[] {
  const room = scene.home ?? '';
  return scene.plan.rules.flatMap((rule, index) => {
    if (!rule.anchor(entry)) return [];
    if (rule.name === 'televisor' && hasRoomTelevision(scene.doc, scene.home, scene.rooms)) return [];
    const repeated = Boolean(rule.fallback || rule.each);
    const key = repeated ? `${index}:${room}` : `${rule.name}:${room}`;
    const fallback = rule.fallback?.(entry);
    const chosen = scene.plan.choice.get(`${index}:${room}`) ?? (fallback ? { catalogId: fallback } : undefined);
    return chosen && (repeated || !scene.served.has(key))
      ? [{ rule, key, chosen, items: rule.place(anchor, chosen.catalogId, undefined, chosen.sizeMm) }] : [];
  });
}

/** Hasta 60 cm a cada lado, en pasos de 5 cm, para hacer sitio a las mesillas sin despegar la cama de su pared. */
const SHIFT_STEPS = 12;

/**
 * Coloca la pieza principal ya validada y sus acompañantes. Contra una pared, la pieza se desliza por ella hasta dejar
 * sitio a sus acompañantes (las dos mesillas de la cama); exenta (una mesa), se aparta en cualquier dirección hasta que
 * caben sus sillas. Devuelve lo colocado, en orden y ya añadido al documento candidato.
 */
export function placeWithCompanions(scene: CompanionScene, settled: NativeDesignFurniture, entry: FurnitureCatalogEntry, along?: Point): NativeDesignFurniture[] {
  const { doc, rooms, allowedRooms, settleRooms, zonePolygon } = scene;
  let anchor = settled;
  const axes = along ? [along] : [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  if (companionGroups(scene, anchor, entry).some(({ rule }) => rule.name !== 'alfombra')) {
    // Cuentan las sillas, mesillas y mesa de centro, sin meter bajo la mesa; la alfombra no estorba a nadie.
    const blocking = (candidate: NativeDesignFurniture) => companionGroups(scene, candidate, entry).filter(({ rule }) => rule.name !== 'alfombra')
      .map(({ rule, chosen }) => ({ rule, items: rule.place(candidate, chosen.catalogId, false, chosen.sizeMm) }));
    const fits = (candidate: NativeDesignFurniture) => {
      const before = doc.furniture.length;
      addSuggestedFurniture(doc, candidate, rooms, allowedRooms, zonePolygon);
      const count = blocking(candidate).reduce((total, { rule, items }) => total + items.filter((companion) => {
        const ok = !nativeFurniturePlacementIssue(doc, companion, rooms, settleRooms, zonePolygon);
        if (ok) addSuggestedFurniture(doc, companion, rooms, allowedRooms, zonePolygon);
        return ok;
      }).slice(0, rule.single?.(entry) ? 1 : undefined).length, 0);
      doc.furniture.splice(before);
      return count;
    };
    const wanted = blocking(anchor).reduce((total, { rule, items }) => total + (rule.single?.(entry) ? 1 : items.length), 0);
    let best = fits(anchor);
    // Exenta, solo si falta la mitad o más: mover una mesa de comedor por una cabecera que no cabe costaba segundos.
    const search = !!along || best * 2 <= wanted;
    for (let step = 1; search && best < wanted && step <= (along ? SHIFT_STEPS : SHIFT_STEPS / 2); step++) for (const axis of axes) for (const sign of [1, -1]) {
      const moved = { ...settled, xMm: settled.xMm + axis.x * sign * step * 50, yMm: settled.yMm + axis.y * sign * step * 50 };
      if (nativeFurniturePlacementIssue(doc, moved, rooms, settleRooms, zonePolygon)) continue;
      const count = fits(moved);
      if (count > best) { best = count; anchor = moved; }
    }
  }
  addSuggestedFurniture(doc, anchor, rooms, allowedRooms, zonePolygon);
  return [anchor, ...placeCompanions(scene, anchor, entry, true)];
}

/** Acompañantes de una pieza ya colocada y, sobre cada uno, los suyos (una sola capa: la lámpara de la mesilla). */
function placeCompanions(scene: CompanionScene, anchor: NativeDesignFurniture, entry: FurnitureCatalogEntry, nested: boolean): NativeDesignFurniture[] {
  const { doc, rooms, allowedRooms, settleRooms, zonePolygon } = scene;
  const out: NativeDesignFurniture[] = [];
  for (const { rule, key, chosen, items } of companionGroups(scene, anchor, entry)) {
    scene.served.add(key);
    let placed = 0;
    const loose = rule.place(anchor, chosen.catalogId, false, chosen.sizeMm);
    for (const [index, companion] of items.entries()) {
      if (placed && rule.single?.(entry)) break;
      // Lo que solo cabe lejos de su mesa, cama o sofá ya no forma conjunto con él. Una silla que no entra bajo la mesa
      // (un modelo 3D cuya caja choca con el tablero) se queda tocando el canto.
      const near = (target: NativeDesignFurniture) => {
        const result = settleNativeDesignFurniture(doc, target, rooms, settleRooms, zonePolygon);
        return !result.issue && Math.hypot(result.item.xMm - target.xMm, result.item.yMm - target.yMm) <= 150 ? result : null;
      };
      // Primero la comprobación exacta (barata); la búsqueda de un sitio cercano, solo una vez y sin meterla bajo la mesa.
      const exact = [companion, loose[index]].find((target) => target && !nativeFurniturePlacementIssue(doc, target, rooms, settleRooms, zonePolygon));
      const seat = exact ? { item: exact, issue: null } : near(loose[index] ?? companion);
      if (!seat) continue;
      out.push(seat.item);
      addSuggestedFurniture(doc, seat.item, rooms, allowedRooms, zonePolygon);
      placed++;
      const seatEntry = entryOf(seat.item);
      if (nested && seatEntry) out.push(...placeCompanions(scene, seat.item, seatEntry, false));
    }
  }
  return out;
}
