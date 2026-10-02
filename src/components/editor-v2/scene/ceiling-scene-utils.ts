import { Color, Path, Shape, SpotLight } from 'three';
import type { Pair, Polygon } from 'polygon-clipping';
import { robustDifference } from '@/canvas/editor-v2/scene/floor-meshes';
import type { Luminaire, Point } from '@/lib/editor-document/schema';
import { spotAimVector, SPOT_CONE_DEG, DEFAULT_ROOF_THICKNESS_MM, type CeilingSurface } from '@/lib/editor-document/ceiling-geometry';

export type CeilingView = 'hidden' | 'transparent' | 'solid';
export const MAX_LUMINAIRE_LIGHTS = 12;
/** La captura usa su visibilidad propia, aunque la escena viva esté en otra cámara. */
export function sceneCoversHidden(view: string | null, ceiling: CeilingView,
  capture: { ceiling: CeilingView; aerial: boolean } | null, recording: boolean): boolean {
  if (recording) return false;
  return capture ? capture.aerial || capture.ceiling === 'hidden' : view === 'top' || ceiling === 'hidden';
}
/** Vistas de estudio: desde arriba sin cubierta; alzados con techo y fachada recortada. */
export function presetCeilingView(view: string, current: CeilingView): CeilingView {
  if (view === 'top' || view === 'isometric' || view === 'drone') return 'hidden';
  if (view === 'front' || view === 'back' || view === 'left' || view === 'right') return 'solid';
  return current;
}
/** El falso techo baja hacia el interior; la losa exterior arranca a la altura de los muros. */
export function roofSlabPlacement(surface: Pick<CeilingSurface, 'heightMm' | 'ceiling'>) {
  const bottomM = (surface.heightMm + surface.ceiling.dropMm) / 1000;
  const thicknessM = (surface.ceiling.roofThicknessMm ?? DEFAULT_ROOF_THICKNESS_MM) / 1000;
  return { bottomM, thicknessM, topM: bottomM + thicknessM };
}

export function captureCeilingView(view: string | null | undefined, custom?: {
  cutaway: boolean; cameraHeightM: number; highestCeilingM: number | null;
  /** Captura para diseñar con IA: desde encima del techo la IA vería una losa, no el interior. */
  forDesign?: boolean;
}): CeilingView {
  if (view === 'top' || view === 'isometric' || view === 'drone') return 'hidden';
  if ((!view || view === 'current' || view === 'custom') && (custom?.cutaway || custom?.forDesign) &&
    custom.highestCeilingM !== null && custom.cameraHeightM > custom.highestCeilingM) return 'hidden';
  return 'solid';
}

/**
 * Los alzados miran la planta desde fuera: se puede retirar la fachada para ver
 * el interior. Cenital, isométrica y dron conservan todos los muros; para ver
 * el interior desde arriba se gestiona el techo por separado.
 */
export function captureCutaway(view: string | null | undefined, cutaway: boolean): boolean {
  if (view === 'exterior') return false;
  if (view === 'top' || view === 'isometric' || view === 'drone') return false;
  if (view === 'front' || view === 'back' || view === 'left' || view === 'right') return true;
  return cutaway;
}

/** El plano usa milímetros X/Y; Three usa metros X/Z. */
export function ceilingShape(boundary: Point[]): Shape {
  const shape = new Shape();
  boundary.forEach((point, index) => index
    ? shape.lineTo(point.x / 1000, -point.y / 1000)
    : shape.moveTo(point.x / 1000, -point.y / 1000));
  shape.closePath();
  return shape;
}

/** Recorta en el techo la misma huella de escalera que en el forjado de la planta superior. */
export function ceilingShapes(boundary: Point[], voids: Point[][] = []): Shape[] {
  if (!voids.length) return [ceilingShape(boundary)];
  const polygon = (points: Point[]): Polygon => [points.map((point) => [point.x / 1000, point.y / 1000] as Pair)];
  return robustDifference(polygon(boundary), voids.map(polygon)).map((rings) => {
    const shape = ceilingShape(rings[0]!.map(([x, y]) => ({ x: x * 1000, y: y * 1000 })));
    for (const ring of rings.slice(1)) {
      const hole = new Path();
      ring.forEach(([x, y], index) => index ? hole.lineTo(x, -y) : hole.moveTo(x, -y));
      hole.closePath(); shape.holes.push(hole);
    }
    return shape;
  });
}

/** Aproximación del color de un radiador térmico para iluminación arquitectónica. */
export function temperatureColor(kelvin: number): Color {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -.1332047592;
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -.0755148492;
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return new Color().setRGB(clamp(red) / 255, clamp(green) / 255, clamp(blue) / 255, 'srgb');
}

/**
 * Cuántas luces de luminaria proyectan sombra a la vez.
 *
 * Cada luz con sombra añade un sampler de shadow map a TODOS los materiales
 * iluminados. Con 16 unidades de textura garantizadas por WebGL, un material
 * PBR del catálogo ya gasta hasta 7 (color, normal, rugosidad, metalicidad,
 * oclusión, emisivo y el entorno), así que solo caben unas pocas sombras. Con
 * este tope el peor caso es 7 + 1 direccional del preset + 2 = 10 unidades, muy
 * por debajo del límite que hacía fallar la compilación del shader.
 */
export const MAX_SHADOW_LIGHTS = 2;

/**
 * Qué luces proyectan sombra, respetando el orden de prioridad con el que
 * llegan (primero las de la estancia en la que está el usuario). Las tiras
 * nunca proyectan sombra: su coste no compensa y no entran en este reparto.
 */
export function shadowLightIds(luminaireIds: readonly string[], budget = MAX_SHADOW_LIGHTS): string[] {
  return luminaireIds.slice(0, Math.max(0, budget));
}

/** Emisor bajo el difusor: el destino comparte el grupo/planta de la luminaria. */
export function createLuminaireEmitter(
  luminaire: Luminaire,
  /** Valores de la escena activa; sin escena son los nominales de la luminaria. */
  effective: { temperatureK: number; lumens: number } = luminaire,
  /** Solo unas pocas luces proyectan sombra: ver `MAX_SHADOW_LIGHTS`. */
  castShadow = true,
): SpotLight {
  const light = new SpotLight(temperatureColor(effective.temperatureK));
  light.power = effective.lumens;
  light.position.set(0, -.025, 0);
  // El plano usa X/Y; en Three la Y del plano es la Z de la escena.
  const aim = spotAimVector(luminaire);
  light.target.position.set(aim.x, -.025 - aim.down, aim.y);
  light.angle = (luminaire.kind === 'spot' ? SPOT_CONE_DEG : luminaire.kind === 'recessed' ? 50 : luminaire.kind === 'flush' ? 80 : 65) * Math.PI / 180;
  light.penumbra = luminaire.kind === 'spot' ? .35 : .5;
  light.decay = 2;
  light.distance = 12;
  light.castShadow = castShadow;
  light.shadow.mapSize.set(512, 512);
  light.shadow.camera.near = .02;
  light.shadow.camera.far = 12;
  light.shadow.bias = -.0001;
  light.shadow.normalBias = .005;
  return light;
}

/** Como mucho 4 luces reales de tira, descontadas del presupuesto global. */
export const MAX_STRIP_LIGHTS = 4;

/**
 * Reparto determinista del presupuesto de luces reales entre luminarias y
 * tiras. Las tiras entran primero (máximo 4, por lúmenes descendentes) porque
 * una tira sin luz real se nota más que una luminaria de más; el resto del
 * presupuesto va a las luminarias en su orden actual. Toda tira descartada
 * conserva su material emisivo: se ve encendida aunque no ilumine.
 */
export function lightBudgetSplit(
  luminaires: readonly BudgetLuminaire[],
  strips: readonly BudgetStrip[],
  budget = MAX_LUMINAIRE_LIGHTS,
  /** Estancia con prioridad: dentro de ella, sus luces entran antes que ninguna otra. */
  priorityRoomId?: string | null,
): { luminaireIds: string[]; stripIds: string[] } {
  const room = Math.max(0, budget);
  const first = (item: { roomId?: string | null }) => (priorityRoomId && item.roomId === priorityRoomId ? 0 : 1);
  // Lo que decide es el encendido efectivo: una luz apagada por la escena no gasta presupuesto.
  const stripIds = [...strips.filter((item) => item.effectiveEnabled ?? item.strip.enabled)]
    .sort((a, b) => first(a) - first(b)
      || (b.effectiveLumens ?? b.lumens) - (a.effectiveLumens ?? a.lumens)
      || a.strip.id.localeCompare(b.strip.id))
    .slice(0, Math.min(MAX_STRIP_LIGHTS, room))
    .map((item) => item.strip.id);
  const luminaireIds = prioritizeByRoom(luminaires.filter((item) => item.effectiveEnabled ?? item.luminaire.enabled), priorityRoomId)
    .slice(0, room - stripIds.length)
    .map(({ luminaire }) => luminaire.id);
  return { luminaireIds, stripIds };
}

export type BudgetLuminaire = {
  luminaire: Pick<Luminaire, 'id' | 'enabled'>; effectiveEnabled?: boolean; roomId?: string | null;
};
export type BudgetStrip = {
  strip: { id: string; enabled: boolean }; lumens: number;
  effectiveEnabled?: boolean; effectiveLumens?: number; roomId?: string | null;
};
export interface BudgetLevel {
  luminaires: readonly BudgetLuminaire[];
  strips: readonly BudgetStrip[];
  /** Solo la planta donde está el usuario prioriza una estancia. */
  priorityRoomId?: string | null;
}

/**
 * Orden estable que pone delante lo que pertenece a la estancia prioritaria.
 * Sin estancia prioritaria el orden de entrada se respeta tal cual.
 */
export function prioritizeByRoom<T extends { roomId?: string | null }>(
  items: readonly T[],
  roomId: string | null | undefined,
): T[] {
  if (!roomId) return [...items];
  return [...items.filter((item) => item.roomId === roomId), ...items.filter((item) => item.roomId !== roomId)];
}

/** Reparto planta a planta: cada una recibe lo que dejó libre la anterior. */
function splitLevels(levels: readonly BudgetLevel[]): { budget: number; used: ReturnType<typeof lightBudgetSplit> }[] {
  let remaining = MAX_LUMINAIRE_LIGHTS;
  return levels.map(({ luminaires, strips, priorityRoomId }) => {
    const budget = remaining;
    const used = lightBudgetSplit(luminaires, strips, budget, priorityRoomId);
    remaining = Math.max(0, remaining - used.luminaireIds.length - used.stripIds.length);
    return { budget, used };
  });
}

/**
 * Cuántas luces encendidas iluminan de verdad frente a cuántas hay encendidas.
 * Sirve para avisar al usuario de que el navegador no las enciende todas.
 */
export function lightingCoverage(levels: readonly BudgetLevel[]): { emitting: number; enabled: number } {
  const enabled = levels.reduce((total, level) =>
    total + level.luminaires.filter((item) => item.effectiveEnabled ?? item.luminaire.enabled).length
    + level.strips.filter((item) => item.effectiveEnabled ?? item.strip.enabled).length, 0);
  const emitting = splitLevels(levels)
    .reduce((total, { used }) => total + used.luminaireIds.length + used.stripIds.length, 0);
  return { emitting, enabled };
}

/**
 * Presupuesto de luces reales para cada planta visible, en orden: la activa
 * primero y el resto con lo que sobra. Cuenta lo que cada planta gasta de
 * verdad con el mismo reparto de `lightBudgetSplit` (luminarias Y tiras), para
 * que la suma de todas nunca pase de `MAX_LUMINAIRE_LIGHTS`.
 */
export function levelLightBudgets(levels: readonly BudgetLevel[]): number[] {
  return splitLevels(levels).map(({ budget }) => budget);
}

/**
 * Emisor de una tira: una sola luz por tira, colocada en el centro de su
 * recorrido y orientada según su uso (foseado hacia el techo, tramo adosado
 * hacia el interior de la estancia, el resto hacia abajo). Sin sombras: el
 * coste de una sombra por tira no compensa en un plano grande.
 */
export function createStripEmitter(strip: {
  temperatureK: number; lumens: number; direction: 'up' | 'down' | 'out'; normal?: Point;
}): SpotLight {
  const light = new SpotLight(temperatureColor(strip.temperatureK));
  light.power = Math.min(4000, strip.lumens);
  light.position.set(0, 0, 0);
  const aim = strip.direction === 'up' ? { x: 0, y: 1, z: 0 }
    : strip.direction === 'out' ? { x: strip.normal?.x ?? 0, y: -.25, z: strip.normal?.y ?? 0 }
    : { x: 0, y: -1, z: 0 };
  light.target.position.set(aim.x, aim.y, aim.z);
  light.angle = (strip.direction === 'up' ? 80 : 70) * Math.PI / 180;
  light.penumbra = .8;
  light.decay = 2;
  light.distance = 8;
  light.castShadow = false;
  return light;
}
