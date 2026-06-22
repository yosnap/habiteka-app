/**
 * Conversión PURA `CanvasDoc` (plano 2D) → descripción de escena 3D (suelo + muros
 * en metros). Sin dependencias de React ni Three: es lógica de dominio testeable, y
 * el componente de render la consume tal cual. Es la pieza F6.1 del 3D navegable.
 *
 * Mapeo de ejes (la fuente de bugs sutiles de desalineación 2D↔3D):
 *   - 2D/Konva: origen arriba-izquierda, X→derecha, Y→ABAJO. Unidad = píxel de stage.
 *   - 3D/Three: X→derecha, Y→ARRIBA (vertical), Z→hacia la cámara. Suelo en plano XZ.
 *   Convención: el eje Y del plano 2D se mapea a Z del 3D (profundidad); la altura
 *   vertical real va en Y. La escena se centra en el centro del plano para dar a la
 *   cámara orbital un pivote natural.
 *
 * Reúsa `scale.ts` (pxToMeters, effectiveHeightM, DEFAULT_CEILING_M): la conversión
 * px↔m y la altura efectiva ya viven allí, puras y testeadas. Aquí NO se duplican.
 */
import type { CanvasDoc, StructKind, StructObj } from '../types';
import { pxToMeters, effectiveHeightM, DEFAULT_CEILING_M } from '../scale';
import { clampIntensity, defaultLight } from '../light';

/** Escala por defecto (px por metro) cuando el doc no trae escala. */
const DEFAULT_PX_PER_METER = 100;

/**
 * Intensidad física máxima de una PointLight cuando la intensidad del doc es 100.
 * La intensidad de F-LUZ es 0–100 (presentacional); aquí se mapea linealmente a un
 * rango de Three. Con `decay:2` la intensidad cae con el cuadrado de la distancia,
 * así que para que una luz de techo (~2 m) ilumine el suelo de forma PERCEPTIBLE hace
 * falta un valor alto. Calibrado contra el render (A/B con/sin luz).
 */
const MAX_POINT_INTENSITY = 40;

/** Distancia y atenuación por defecto de una luz puntual de sala (metros). */
const DEFAULT_LIGHT_DISTANCE_M = 12;
const DEFAULT_LIGHT_DECAY = 2;

/** Fracción de la altura de techo a la que cuelga la luz (lámpara de techo). */
const LIGHT_HEIGHT_FRACTION = 0.8;

/**
 * Número máximo de luces puntuales en la escena. Cada PointLight es cara (forward
 * rendering recorre todas por fragmento), así que un plano con muchos focos hundiría
 * el FPS. Si el doc tiene más, se conservan las MÁS INTENSAS y se descartan el resto.
 */
const MAX_LIGHTS = 8;

/** Tipos estructurales que forman el caparazón de la sala (suelo + muros). */
const STRUCTURAL_KINDS: ReadonlySet<StructKind> = new Set<StructKind>(['wall', 'window', 'door']);

/**
 * ¿El objeto es una luz? Una luz es el kind dedicado `foco` o cualquier objeto con
 * atributos `light`. Es un criterio más amplio que el `isLight(kind)` de `light.ts`
 * (que solo mira el kind): aquí cuenta también un objeto al que se le añadió `light`.
 * Esta es la fuente de verdad para el render 3D (separa muebles de luces).
 */
function isLight(o: StructObj): boolean {
  return o.kind === 'foco' || o.light != null;
}

/** ¿El objeto es un mueble colocable? (no estructural y no luz). */
function isFurniture(o: StructObj): boolean {
  return !STRUCTURAL_KINDS.has(o.kind) && !isLight(o);
}

/** Caja de un muro en metros, ya centrada en el origen de la escena (plano XZ). */
export interface WallBox {
  id: string;
  /** Centro de la caja en metros: [x, y, z] (y = altura/2, apoyada en el suelo). */
  center: [number, number, number];
  /** Tamaño de la caja en metros: [ancho(X), alto(Y), fondo(Z)]. */
  size: [number, number, number];
  /** Rotación alrededor del eje vertical (Y), en radianes. */
  rotationY: number;
}

/** Suelo rectangular en metros, centrado en el origen. */
export interface FloorRect {
  /** Tamaño del suelo en metros: [ancho(X), fondo(Z)]. */
  size: [number, number];
}

/**
 * Mueble colocable en la escena: un `StructObj` no estructural y no luz, ya con su
 * posición/tamaño/rotación en metros. El componente carga el glTF del `kind` (o un
 * placeholder) y lo coloca con estos datos. `center.y` apoya el objeto en el suelo.
 */
export interface FurnitureItem {
  id: string;
  kind: StructKind;
  /** Centro en metros: [x, y, z], con y = altura/2 (apoyado en el suelo). */
  center: [number, number, number];
  /** Tamaño real en metros: [ancho(X), alto(Y), fondo(Z)]. */
  size: [number, number, number];
  /** Rotación alrededor del eje vertical (Y), en radianes. */
  rotationY: number;
  /** Volteo horizontal (espejo en X): refleja el objeto, como en el plano 2D. */
  flipX: boolean;
}

/**
 * Luz de la escena derivada de una luz de primera clase (F-LUZ) del doc. Se renderiza
 * como una luz puntual (PointLight) en `position`, con `color` e `intensity` físicos.
 */
export interface SceneLight {
  id: string;
  /** Posición en metros: [x, y, z], y = altura a la que cuelga la luz. */
  position: [number, number, number];
  /** Color de la luz en hex (#rrggbb). */
  color: string;
  /** Intensidad física para Three (derivada de la 0–100 del doc). */
  intensity: number;
  /** Alcance de la luz en metros (0 = infinito). */
  distance: number;
  /** Atenuación con la distancia. */
  decay: number;
}

/**
 * Mapea la intensidad presentacional del doc (0–100) a la intensidad física de una
 * PointLight de Three (0–`MAX_POINT_INTENSITY`), de forma lineal. Reusa el clamp de
 * `light.ts` para no duplicar la validación de rango.
 */
export function intensity0to100ToPhysical(intensidad: number): number {
  return (clampIntensity(intensidad) / 100) * MAX_POINT_INTENSITY;
}

/** Descripción completa de la escena 3D derivada del doc (serializable). */
export interface Scene3D {
  floor: FloorRect;
  walls: WallBox[];
  /** Muebles (objetos no estructurales y no luz), ya posicionados en metros. */
  furniture: FurnitureItem[];
  /** Luces de primera clase (F-LUZ) del doc, como luces puntuales. */
  lights: SceneLight[];
  /** Altura de techo efectiva usada (m). */
  ceilingHeightM: number;
  /** Escala efectiva (px por metro), para colocar muebles con la misma. */
  pxPerMeter: number;
  /** Centro del plano en px, para reusar al posicionar muebles del doc. */
  planCenterPx: [number, number];
}

/** Sub-tipo geométrico mínimo: posición (esquina sup-izq) + tamaño en planta (px). */
type PlanRect = Pick<StructObj, 'x' | 'y' | 'width' | 'height'>;

/**
 * Resuelve la escala (px por metro) del doc: su `pxPerMeter` si la escala es usable,
 * o el valor por defecto. No lanza: un plano sin escala trabaja a 100 px/m.
 */
export function resolvePxPerMeter(doc: CanvasDoc): number {
  const px = doc.scale?.pxPerMeter;
  return typeof px === 'number' && Number.isFinite(px) && px > 0 ? px : DEFAULT_PX_PER_METER;
}

/**
 * Centro del plano (en px) = centro del bounding box de los objetos dados. Usarlo
 * como origen evita que la sala aparezca desplazada del pivote de la cámara.
 */
export function planCenterPx(objects: readonly PlanRect[]): [number, number] {
  if (objects.length === 0) return [0, 0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of objects) {
    minX = Math.min(minX, o.x);
    minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + o.width);
    maxY = Math.max(maxY, o.y + o.height);
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

/**
 * Centro geométrico de un objeto en píxeles de plano, calculado COMO LO PINTA KONVA: el
 * objeto rota sobre su ORIGEN (esquina sup-izq `x,y`), así que el centro es la esquina más
 * el offset `(w/2, h/2)` ROTADO por `rotation`. Para `rotation=0` se reduce a `(x+w/2, y+h/2)`.
 * Esto es lo que evita el desfase 2D↔3D en objetos rotados (un muro a 90° caía a ~2 m de
 * donde el usuario lo ve). Lógica pura, testeable.
 */
export function objectCenterPx(
  obj: Pick<StructObj, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
): [number, number] {
  const rad = ((obj.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  return [obj.x + hw * cos - hh * sin, obj.y + hw * sin + hh * cos];
}

/**
 * Mapea el centro (en planta, px) de un objeto a su posición en metros en el plano
 * XZ, relativa al centro del plano:
 *   X(3D) = (centroX_px − centroPlanoX) / pxPerMeter
 *   Z(3D) = (centroY_px − centroPlanoY) / pxPerMeter   (Y-2D → Z-3D)
 * Usa `objectCenterPx`, que respeta el pivote de rotación de Konva (rota sobre la esquina).
 */
export function planPointToXZ(
  obj: Pick<StructObj, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  center: readonly [number, number],
  pxPerMeter: number,
): [number, number] {
  const [cx, cy] = objectCenterPx(obj);
  return [pxToMeters(cx - center[0], { pxPerMeter }), pxToMeters(cy - center[1], { pxPerMeter })];
}

/**
 * Convierte la rotación 2D de un objeto (grados, horaria en un sistema Y-abajo) a la
 * rotación 3D alrededor del eje vertical Y. Al invertirse el eje vertical entre 2D y
 * 3D, el sentido de giro se invierte: `rotationY = −rot·π/180`.
 */
export function rotation2DToY(rotationDeg: number): number {
  return (-(rotationDeg || 0) * Math.PI) / 180;
}

/** Bounding box (px) de un conjunto de rectángulos en planta. */
function boundingBoxPx(objects: readonly PlanRect[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of objects) {
    minX = Math.min(minX, o.x);
    minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + o.width);
    maxY = Math.max(maxY, o.y + o.height);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Acota la lista de luces a `MAX_LIGHTS`, conservando las MÁS INTENSAS (las que más
 * aportan a la escena) y descartando el resto. Estable: ante empates de intensidad
 * conserva el orden de aparición. Evita que un plano con muchos focos hunda el FPS.
 */
export function limitLights(lights: SceneLight[], max = MAX_LIGHTS): SceneLight[] {
  if (lights.length <= max) return lights;
  // Índice para desempatar de forma estable (por orden de aparición).
  return lights
    .map((light, i) => ({ light, i }))
    .sort((a, b) => b.light.intensity - a.light.intensity || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((e) => e.light);
}

/**
 * Construye la escena 3D (suelo + muros) a partir del doc. Los muros/ventanas/puertas
 * se tratan como cajas estructurales (sin huecos: refinamiento posterior). El suelo es
 * el bounding box del contorno estructural (o de todos los objetos si no hay muros).
 */
export function docToScene(doc: CanvasDoc): Scene3D {
  const pxPerMeter = resolvePxPerMeter(doc);
  const ceilingHeightM = doc.ceilingHeightM ?? DEFAULT_CEILING_M;
  const center = planCenterPx(doc.objects);

  const structural = doc.objects.filter((o) => STRUCTURAL_KINDS.has(o.kind));

  const furniture: FurnitureItem[] = doc.objects.filter(isFurniture).map((o) => {
    const [x, z] = planPointToXZ(o, center, pxPerMeter);
    const w = pxToMeters(o.width, { pxPerMeter });
    const d = pxToMeters(o.height, { pxPerMeter });
    const h = effectiveHeightM(o, ceilingHeightM);
    return {
      id: o.id,
      kind: o.kind,
      center: [x, h / 2, z],
      size: [w, h, d],
      rotationY: rotation2DToY(o.rotation),
      flipX: o.flipX === true,
    };
  });

  const allLights: SceneLight[] = doc.objects.filter(isLight).map((o) => {
    const [x, z] = planPointToXZ(o, center, pxPerMeter);
    const props = o.light ?? defaultLight();
    return {
      id: o.id,
      position: [x, ceilingHeightM * LIGHT_HEIGHT_FRACTION, z],
      color: props.color,
      intensity: intensity0to100ToPhysical(props.intensidad),
      distance: DEFAULT_LIGHT_DISTANCE_M,
      decay: DEFAULT_LIGHT_DECAY,
    };
  });
  const lights = limitLights(allLights);

  const walls: WallBox[] = structural.map((o) => {
    const [x, z] = planPointToXZ(o, center, pxPerMeter);
    const w = pxToMeters(o.width, { pxPerMeter });
    const d = pxToMeters(o.height, { pxPerMeter });
    // Altura del muro: su heightM propio, o la de techo del plano (vía scale.ts).
    const h = effectiveHeightM(o, ceilingHeightM);
    return {
      id: o.id,
      center: [x, h / 2, z],
      size: [w, h, d],
      rotationY: rotation2DToY(o.rotation),
    };
  });

  // Suelo: bounding box de SOLO los muros (no de ventanas/puertas, que pueden sobresalir
  // del contorno por diseño y estirarían el suelo). Si no hay muros, cae a todos los objetos.
  const wallsForFloor = doc.objects.filter((o) => o.kind === 'wall');
  const ref = wallsForFloor.length > 0 ? wallsForFloor : doc.objects;
  const floor: FloorRect = (() => {
    if (ref.length === 0) return { size: [0, 0] };
    const bb = boundingBoxPx(ref);
    return {
      size: [
        pxToMeters(Math.max(0, bb.maxX - bb.minX), { pxPerMeter }),
        pxToMeters(Math.max(0, bb.maxY - bb.minY), { pxPerMeter }),
      ],
    };
  })();

  return { floor, walls, furniture, lights, ceilingHeightM, pxPerMeter, planCenterPx: center };
}

/**
 * ¿Debe ocultarse este muro para ver el interior? (recorte por cámara, estilo
 * Planner5D/Sims). La sala está centrada en el origen, así que el muro tapa el interior
 * cuando está en el MISMO lado que la cámara respecto al centro: el coseno del ángulo
 * entre el vector centro→muro y el vector centro→cámara (ambos en el plano XZ) supera un
 * umbral. Lógica pura (sin Three): el componente la llama cada frame con la cámara actual.
 *
 * @param wallXZ  centro del muro en el plano XZ (metros).
 * @param camXZ   posición de la cámara en el plano XZ (metros).
 * @param threshold  coseno mínimo para ocultar (0 = oculta la mitad frontal; mayor = más
 *                   selectivo, oculta solo los muros más de frente). Por defecto 0,35.
 */
export function shouldHideWall(
  wallXZ: readonly [number, number],
  camXZ: readonly [number, number],
  threshold = 0.35,
): boolean {
  return shouldHideWallXZ(wallXZ[0], wallXZ[1], camXZ[0], camXZ[1], threshold);
}

/**
 * Igual que `shouldHideWall` pero con coordenadas sueltas (sin arrays), para llamarlo en
 * un bucle de render por frame sin asignar memoria. La de tuplas delega aquí.
 */
export function shouldHideWallXZ(
  wallX: number,
  wallZ: number,
  camX: number,
  camZ: number,
  threshold = 0.35,
): boolean {
  const wLen = Math.hypot(wallX, wallZ);
  const cLen = Math.hypot(camX, camZ);
  // Muro en el centro o cámara en el centro: no hay dirección clara, no ocultar.
  if (wLen < 1e-3 || cLen < 1e-3) return false;
  const cos = (wallX * camX + wallZ * camZ) / (wLen * cLen);
  return cos > threshold;
}
