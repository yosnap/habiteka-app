import { KITCHEN_SLOT_DEFAULTS, KITCHEN_SLOT_KINDS, kitchenRunDefaults, type KitchenRun, type KitchenSlot, type KitchenSlotKind } from './kitchen-run-types';
import { surfaceMaterial } from './surface-materials';
import { localToWorld } from './spatial-properties';
import { placeRunOnFace } from './proposal-coordinates';
import type { RoomWallFace } from './room-wall-faces';

/**
 * Cocina que propone la IA: un tramo del mueble de cocina modular del editor contra una pared, con sus aparatos en
 * orden. Con piezas sueltas (módulo, placa, horno, nevera) la IA las repartía por la estancia y no quedaba una cocina;
 * el tramo lleva encimera y zócalo continuos, altos y los aparatos encajados, como una cocina de obra.
 */
export interface NativeDesignKitchen {
  /** Extremo inicial de la línea trasera, contra el muro; el cuerpo ocupa el fondo hacia +y local, como en el editor. */
  xMm: number;
  yMm: number;
  rotation: number;
  lengthMm: number;
  appliances: KitchenSlotKind[];
  uppers: boolean;
  frontColor?: string;
  worktopMaterialId?: string;
  reason: string;
}

export const KITCHEN_DEPTH_MM = 600;
export const MIN_KITCHEN_MM = 1200;
/** Lo que antes falta en una cocina si el tramo no da para todo: se cae primero el final de la lista. */
const PRIORITY: readonly KitchenSlotKind[] = ['fregadero', 'vitroceramica', 'frigorifico-columna', 'lavavajillas', 'horno', 'lavadora'];
/** Van juntos, sin módulo entre medias: el lavavajillas junto al fregadero y el horno junto a la placa. */
const PAIRS: readonly (readonly [KitchenSlotKind, KitchenSlotKind])[] = [['fregadero', 'lavavajillas'], ['vitroceramica', 'horno']];
const together = (a: KitchenSlotKind, b: KitchenSlotKind) => PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
const slotWidth = (kinds: readonly KitchenSlotKind[]) => kinds.reduce((sum, kind) => sum + KITCHEN_SLOT_DEFAULTS[kind].widthMm, 0);

export function isKitchenSlotKind(value: unknown): value is KitchenSlotKind {
  return typeof value === 'string' && (KITCHEN_SLOT_KINDS as readonly string[]).includes(value);
}

/**
 * Aparatos en el orden pedido, con módulos de encimera entre los grupos: el espacio sobrante se reparte el doble entre
 * grupos que en los extremos, y la nevera de columna va al ras del extremo. `reserved` deja libre la esquina de una L.
 */
export function kitchenSlots(lengthMm: number, appliances: readonly KitchenSlotKind[], reserved = { startMm: 0, endMm: 0 }): KitchenSlot[] {
  const usable = lengthMm - reserved.startMm - reserved.endMm;
  let kinds = appliances.filter((kind, index) => isKitchenSlotKind(kind) && appliances.indexOf(kind) === index);
  while (kinds.length && slotWidth(kinds) > usable) {
    const drop = [...PRIORITY].reverse().find((kind) => kinds.includes(kind));
    kinds = kinds.filter((kind) => kind !== drop);
  }
  if (!kinds.length) return [];
  const weights = kinds.map((kind, index) => index === 0 ? Number(kind !== 'frigorifico-columna') : together(kinds[index - 1]!, kind) ? 0 : 2);
  weights.push(Number(kinds.at(-1) !== 'frigorifico-columna'));
  const total = weights.reduce((sum, weight) => sum + weight, 0), free = usable - slotWidth(kinds);
  let x = reserved.startMm;
  return kinds.map((kind, index) => {
    x += total ? Math.floor(free * weights[index]! / total) : 0;
    const { widthMm, color } = KITCHEN_SLOT_DEFAULTS[kind];
    const slot = { id: crypto.randomUUID(), kind, positionMm: x + widthMm / 2, widthMm, color };
    x += widthMm;
    return slot;
  });
}

/** Mueble de cocina del editor para la propuesta; los aparatos se encajan después, cuando se sabe qué esquinas comparte. */
export function proposalKitchenRun(kitchen: NativeDesignKitchen, elevationMm = 0): KitchenRun {
  const color = kitchen.frontColor && /^#[0-9a-f]{6}$/i.test(kitchen.frontColor) ? kitchen.frontColor : undefined;
  const run = kitchenRunDefaults({ id: crypto.randomUUID(), x: kitchen.xMm, y: kitchen.yMm, widthMm: kitchen.lengthMm,
    rotation: kitchen.rotation, depthMm: KITCHEN_DEPTH_MM, elevationMm, ...(color ? { color } : {}) });
  if (kitchen.worktopMaterialId && surfaceMaterial(kitchen.worktopMaterialId)) run.kitchen.worktopMaterialId = kitchen.worktopMaterialId;
  if (kitchen.uppers) run.kitchen.uppers = { bottomMm: 1450, heightMm: 700, depthMm: 350, color: run.color };
  run.kitchen.slots = kitchenSlots(run.widthMm, kitchen.appliances);
  return run;
}

/**
 * Encaja los aparatos de cada tramo dejando libre el fondo del tramo vecino en una esquina en L; la nevera de columna va
 * al extremo contrario a la esquina, donde no corta la encimera.
 */
export function fitKitchenSlots(run: KitchenRun, appliances: readonly KitchenSlotKind[], peers: readonly KitchenRun[]): void {
  const ends = [0, run.widthMm].map((x) => localToWorld(run, { x, y: 0 }));
  const reserve = (end: { x: number; y: number }) => peers.some((peer) => peer.id !== run.id
    && Math.abs(Math.cos((peer.rotation - run.rotation) * Math.PI / 180)) < Math.cos(Math.PI / 12) && [0, peer.widthMm].some((x) => { const point = localToWorld(peer, { x, y: 0 }); return Math.hypot(point.x - end.x, point.y - end.y) <= peer.depthMm + 10; }))
    ? KITCHEN_DEPTH_MM + 50 : 0;
  const reserved = { startMm: reserve(ends[0]!), endMm: reserve(ends[1]!) };
  const others = appliances.filter((kind) => kind !== 'frigorifico-columna'), fridge = appliances.includes('frigorifico-columna');
  const ordered = !fridge ? others : reserved.endMm > reserved.startMm ? ['frigorifico-columna' as const, ...others] : [...others, 'frigorifico-columna' as const];
  run.kitchen.slots = kitchenSlots(run.widthMm, ordered, reserved);
}

/** Tramo de pared que ocupa un brazo de la cocina. */
export interface KitchenArm { face: RoomWallFace; fromMm: number; toMm: number }
/** Paso libre delante de la encimera. */
const FRONT_CLEAR_MM = 1000;
/** Encimera de trabajo además de los aparatos; más allá de este margen el mueble no crece aunque la pared siga. */
const WORKTOP_MM = 1200, WORKTOP_MAX_MM = 2400;
/** Orden de trabajo de una cocina: fregadero con lavavajillas, encimera, placa con horno; la nevera en un extremo. */
const WORK_ORDER: readonly KitchenSlotKind[][] = [['fregadero', 'lavavajillas'], ['vitroceramica', 'horno'], ['lavadora']];
const isHorizontal = (face: RoomWallFace) => face.side === 'arriba' || face.side === 'abajo';
const endPoint = (arm: KitchenArm, at: number) => isHorizontal(arm.face) ? { x: at, y: arm.face.atMm } : { x: arm.face.atMm, y: at };
/** Extremo del brazo que coincide con un extremo del otro, en paredes perpendiculares: la esquina de la L. */
function sharedCorner(a: KitchenArm, b: KitchenArm): { a: number; b: number } | null {
  if (isHorizontal(a.face) === isHorizontal(b.face)) return null;
  for (const atA of [a.fromMm, a.toMm]) for (const atB of [b.fromMm, b.toMm]) {
    const p = endPoint(a, atA), q = endPoint(b, atB);
    if (Math.hypot(p.x - q.x, p.y - q.y) <= 2) return { a: atA, b: atB };
  }
  return null;
}
/** Acorta un brazo por el extremo que no es la esquina (o por el final si no la tiene). */
function trimArm(arm: KitchenArm, lengthMm: number, corner?: number): KitchenArm {
  if (arm.toMm - arm.fromMm <= lengthMm) return arm;
  return corner === arm.toMm ? { ...arm, fromMm: arm.toMm - lengthMm } : { ...arm, toMm: arm.fromMm + lengthMm };
}

/**
 * Dónde va la cocina, como lo decidiría un cocinista: en las paredes libres de la estancia con 1 m de paso delante, en
 * lineal si un tramo da para los aparatos y la encimera, si no en L por una esquina; la pared que prefiere la IA manda
 * si cabe. La IA elegía la pared más corta (por evitar una ventana) y metía cinco aparatos en 1,5 m. Con `strict` (el
 * cliente dibujó la encimera en su boceto) mandan esas paredes aunque no quepa todo: sobra antes un aparato que
 * cambiar la cocina de sitio.
 */
export function planKitchen(faces: readonly RoomWallFace[], extent: { x: number; y: number }, appliances: readonly KitchenSlotKind[],
  preferred: readonly string[] = [], strict = false): { arm: KitchenArm; appliances: KitchenSlotKind[] }[] {
  const kinds = appliances.filter((kind, index) => isKitchenSlotKind(kind) && appliances.indexOf(kind) === index);
  const spans: KitchenArm[] = faces.filter((face) => (isHorizontal(face) ? extent.y : extent.x) >= KITCHEN_DEPTH_MM + FRONT_CLEAR_MM)
    .flatMap((face) => face.free.filter(([from, to]) => to - from >= MIN_KITCHEN_MM).map(([fromMm, toMm]) => ({ face, fromMm, toMm })));
  if (!spans.length) return [];
  const needed = slotWidth(kinds) + WORKTOP_MM, most = slotWidth(kinds) + WORKTOP_MAX_MM, corner = KITCHEN_DEPTH_MM + 50;
  const length = (arm: KitchenArm) => arm.toMm - arm.fromMm;
  const options = [
    ...spans.map((arm) => ({ arms: [trimArm(arm, most)], capacity: Math.min(length(arm), most) })),
    ...spans.flatMap((a, i) => spans.slice(i + 1).flatMap((b) => {
      const shared = sharedCorner(a, b);
      if (!shared) return [];
      const [long, short, longCorner, shortCorner] = length(a) >= length(b) ? [a, b, shared.a, shared.b] : [b, a, shared.b, shared.a];
      const longArm = trimArm(long, Math.max(MIN_KITCHEN_MM, most - length(short) + 2 * corner), longCorner);
      return [{ arms: [longArm, trimArm(short, Math.max(MIN_KITCHEN_MM, most - length(longArm) + 2 * corner), shortCorner)],
        capacity: Math.min(most, length(longArm) + length(short) - 2 * corner) }];
    })),
  ];
  // Primero lo que da para todo; entre eso, la pared preferida y el lineal antes que la L. Si nada da, la más larga.
  const wanted = Math.min(preferred.length, 2);
  const rank = (option: typeof options[number]) => {
    const covered = option.arms.filter((arm) => preferred.includes(arm.face.id)).length, missing = wanted - covered;
    if (strict) return [missing, option.arms.length - covered, Number(option.capacity < needed), -option.capacity];
    const other = Number(!covered);
    return option.capacity >= needed ? [0, other, option.arms.length, -option.capacity] : [1, -option.capacity, other, option.arms.length];
  };
  const compare = (a: number[], b: number[]) => a.map((value, index) => value - b[index]!).find((difference) => difference !== 0) ?? 0;
  const best = options.sort((x, y) => compare(rank(x), rank(y)))[0]!;
  const groups = WORK_ORDER.map((group) => group.filter((kind) => kinds.includes(kind))).filter((group) => group.length);
  const fridge = kinds.includes('frigorifico-columna') ? ['frigorifico-columna' as const] : [];
  if (best.arms.length === 1) return [{ arm: best.arms[0]!, appliances: [...groups.flat(), ...fridge] }];
  // En L, el brazo largo lleva los grupos que le caben con encimera entre medias, el corto la nevera en su extremo
  // libre y lo que sobre; si un grupo no cabe con encimera, va pegado al anterior antes que perderlo.
  const [longArm, shortArm] = best.arms as [KitchenArm, KitchenArm];
  const longRoom = length(longArm) - corner, shortRoom = length(shortArm) - corner - slotWidth(fridge);
  const onLong: KitchenSlotKind[] = [], onShort: KitchenSlotKind[] = [];
  for (const group of groups) {
    const longUsed = slotWidth(onLong), gaps = onLong.length ? 300 * (groups.indexOf(group)) : 0;
    if (longUsed + slotWidth(group) + gaps <= longRoom) onLong.push(...group);
    else if (slotWidth(onShort) + slotWidth(group) <= shortRoom) onShort.push(...group);
    else (longRoom - longUsed >= shortRoom - slotWidth(onShort) ? onLong : onShort).push(...group);
  }
  return [{ arm: longArm, appliances: onLong }, { arm: shortArm, appliances: [...onShort, ...fridge] }];
}

/** Brazo de cocina listo para validar: pegado a su pared con la trasera contra el muro. */
export function kitchenOnArm(arm: KitchenArm, base: Omit<NativeDesignKitchen, 'xMm' | 'yMm' | 'rotation' | 'lengthMm' | 'appliances'>,
  appliances: KitchenSlotKind[]): NativeDesignKitchen {
  return { ...base, ...placeRunOnFace(arm.face, arm.fromMm, arm.toMm, KITCHEN_DEPTH_MM), lengthMm: Math.round(arm.toMm - arm.fromMm), appliances };
}
