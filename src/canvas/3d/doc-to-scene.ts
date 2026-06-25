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
import { CEILING_KINDS } from '../types';
import { pxToMeters, effectiveHeightM, DEFAULT_CEILING_M } from '../scale';
import { clampIntensity, defaultLight } from '../light';
import { associateOpening, splitWallWithOpenings, wallAxis, wallEndpointsXZ } from './wall-openings';
import { floorPolygonFromWalls } from './floor-from-walls';
import { objectCenterY } from './placement';

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

/** ¿El objeto es un mueble de techo (ceiling_light, pendant_lamp, ...)? */
function isCeilingItem(o: StructObj): boolean {
  return (CEILING_KINDS as Set<string>).has(o.kind);
}

/** ¿El objeto es un mueble colocable en suelo/pared? (no estructural, no luz, no techo). */
function isFurniture(o: StructObj): boolean {
  return !STRUCTURAL_KINDS.has(o.kind) && !isLight(o) && !isCeilingItem(o);
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
  /** Color del material en hex (#rrggbb), si el muro lo define; si no, el render usa el default. */
  color?: string;
  /** Oculto en el 3D: el usuario lo ha ocultado vía toggle (F3). No altera la geometría del suelo. */
  hidden?: boolean;
  /** Id del objeto muro de origen (sin sufijo de hueco), para editarlo desde el 3D. */
  sourceId?: string;
}

/**
 * Panel de cristal de una ventana, en el hueco abierto del muro (plano XZ). Mismo
 * sistema de coordenadas que `WallBox`: centro en metros, tamaño y rotación vertical.
 * La puerta NO genera cristal, solo la ventana.
 */
export interface GlassPane {
  id: string;
  /** Centro del cristal en metros: [x, y, z] (y = centro del vano). */
  center: [number, number, number];
  /** Tamaño del cristal en metros: [ancho(X), alto(Y), fondo(Z)]. */
  size: [number, number, number];
  /** Rotación alrededor del eje vertical (Y), en radianes (la del muro). */
  rotationY: number;
}

/**
 * Pieza sólida de carpintería de un hueco: perfiles del MARCO y travesaño de una ventana,
 * o la HOJA de una puerta. Mismo sistema de coordenadas que `WallBox`. El `material`
 * decide su aspecto en el render (carpintería clara vs madera de puerta). Esto es lo que
 * hace que un hueco se lea como una VENTANA/PUERTA y no como un agujero.
 */
export interface OpeningFrame {
  id: string;
  /** Centro de la pieza en metros: [x, y, z]. */
  center: [number, number, number];
  /** Tamaño en metros: [ancho(X), alto(Y), fondo(Z)]. */
  size: [number, number, number];
  /** Rotación alrededor del eje vertical (Y), en radianes (la del muro). */
  rotationY: number;
  /** Aspecto: `frame` = carpintería de ventana; `door` = hoja de puerta (madera). */
  material: 'frame' | 'door';
}

/** Suelo rectangular en metros. */
export interface FloorRect {
  /** Tamaño del suelo en metros: [ancho(X), fondo(Z)]. */
  size: [number, number];
  /**
   * Centro del suelo en el plano XZ (metros), relativo al centro de la escena. No es
   * siempre [0,0]: el suelo abarca solo los muros, cuyo bbox puede no coincidir con el
   * centro del bbox de TODOS los objetos (el origen de la escena). Centrarlo aquí evita
   * que el suelo aparezca desplazado respecto a las paredes.
   */
  center: [number, number];
  /**
   * Polígono del suelo en el plano XZ (metros, relativo al centro de la escena), cuando el
   * doc trae `floorOutline` (formas no rectangulares L/U/T). Ausente ⇒ el render dibuja un
   * suelo rectangular con `size`/`center` (comportamiento previo). Cuando está presente,
   * `size` sigue siendo el bbox del polígono (sirve para la cámara y el grid).
   */
  polygon?: Array<[number, number]>;
}

/**
 * Mueble colocable en la escena: un `StructObj` no estructural y no luz, ya con su
 * posición/tamaño/rotación en metros. El componente carga el glTF del `kind` (o un
 * placeholder) y lo coloca con estos datos. `center.y` apoya el objeto en el suelo.
 */
export interface FurnitureItem {
  id: string;
  kind: StructKind;
  /**
   * Centro en metros: [x, y, z], con y = floorElevationM + altura/2.
   * El SelectionOverlay usa center[1] para colocar la caja wireframe.
   */
  center: [number, number, number];
  /** Tamaño real en metros: [ancho(X), alto(Y), fondo(Z)]. */
  size: [number, number, number];
  /** Rotación alrededor del eje vertical (Y), en radianes. */
  rotationY: number;
  /** Volteo horizontal (espejo en X): refleja el objeto, como en el plano 2D. */
  flipX: boolean;
  /**
   * Altura de la base del mueble sobre el suelo (metros). 0 = apoyado en el suelo.
   * Ejemplos: vitrocerámica sobre encimera (0.85), microondas en estante (1.35).
   */
  floorElevationM: number;
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
  /** Cristales de las ventanas, en los huecos abiertos de los muros. */
  glassPanes: GlassPane[];
  /** Carpintería de los huecos: marcos/travesaños de ventana y hojas de puerta. */
  openingFrames: OpeningFrame[];
  /** Muebles de suelo/pared (no estructurales, no luz, no techo), posicionados en metros. */
  furniture: FurnitureItem[];
  /** Elementos de techo (ceiling_light, pendant_lamp), colgados desde arriba. */
  ceilingItems: FurnitureItem[];
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

/**
 * Las 4 esquinas de un objeto en planta (px), COMO LO PINTA KONVA: el objeto rota sobre
 * su ORIGEN (esquina sup-izq `x,y`), no sobre su centro. Para `rotation=0` son las
 * esquinas axis-aligned habituales. Misma convención de pivote que `objectCenterPx`.
 */
export function objectCornersPx(
  obj: Pick<StructObj, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
): Array<[number, number]> {
  const rad = ((obj.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const offsets: Array<[number, number]> = [
    [0, 0],
    [obj.width, 0],
    [obj.width, obj.height],
    [0, obj.height],
  ];
  return offsets.map(([dx, dy]) => [obj.x + dx * cos - dy * sin, obj.y + dx * sin + dy * cos]);
}

/**
 * Bounding box (px) de un conjunto de objetos en planta, RESPETANDO su rotación. Un muro
 * dibujado con Draw Walls viene rotado (atan2 del segmento); usar `x..x+width` sin rotar
 * inflaría y descentraría el bbox (suelo más grande que la sala). Por eso se expande sobre
 * las esquinas rotadas, igual que `objectCenterPx` respeta el pivote para posicionar.
 */
function boundingBoxPx(objects: readonly StructObj[]): {
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
    for (const [px, py] of objectCornersPx(o)) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
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
 * Altura de la BASE del mueble sobre el suelo (metros) por kind.
 * 0 = apoyado en el suelo (valor por defecto para los que no aparecen aquí).
 * Se usa para colocar verticalmente ítems que descansan sobre otros muebles.
 */
const FLOOR_ELEVATION_M: Partial<Record<StructKind, number>> = {
  vitroceramica: 0.85, // descansa sobre la encimera (~0.85m de alto)
  microondas: 1.35,    // en estante por encima de la encimera
};

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

  const buildFurnitureItem = (o: StructObj): FurnitureItem => {
    const [x, z] = planPointToXZ(o, center, pxPerMeter);
    const w = pxToMeters(o.width, { pxPerMeter });
    const d = pxToMeters(o.height, { pxPerMeter });
    const h = effectiveHeightM(o, ceilingHeightM);
    const elevM = o.elevationM ?? FLOOR_ELEVATION_M[o.kind] ?? 0;
    return {
      id: o.id,
      kind: o.kind,
      center: [x, objectCenterY({ kind: o.kind, heightM: o.heightM, elevationM: elevM }, ceilingHeightM), z],
      size: [w, h, d],
      rotationY: rotation2DToY(o.rotation),
      flipX: o.flipX === true,
      floorElevationM: elevM,
    };
  };

  const furniture: FurnitureItem[] = doc.objects.filter(isFurniture).map(buildFurnitureItem);
  const ceilingItems: FurnitureItem[] = doc.objects.filter(isCeilingItem).map(buildFurnitureItem);

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

  // Muros con HUECOS reales: cada ventana/puerta se asocia (por cercanía geométrica) al muro
  // 'wall' que la contiene y abre un vano, troceando ese muro en cajas (izq/dcha/dintel/alféizar).
  // Window/door ya NO emiten un WallBox macizo propio (antes se fundían con la pared). Un muro
  // sin huecos sigue siendo una sola caja. Las ventanas añaden cristales (`glassPanes`).
  const wallObjs = structural.filter((o) => o.kind === 'wall');
  const openings = structural.filter((o) => o.kind === 'window' || o.kind === 'door');
  // Agrupa los huecos por el muro al que se asocian (clave = id del muro).
  const openingsByWall = new Map<string, StructObj[]>();
  for (const op of openings) {
    const wall = associateOpening(op, wallObjs);
    if (!wall) continue; // hueco sin muro (inalcanzable con datos válidos): se omite, no caja maciza.
    const list = openingsByWall.get(wall.id);
    if (list) list.push(op);
    else openingsByWall.set(wall.id, [op]);
  }
  // Extensión de juntas 3D: cada extremo de muro que toca a otro recibe
  // extendP1Px/P2Px ≈ t_vecino/2 para que las BoxGeometry se solapen en la esquina.
  const JUNCTION_THRESH2 = 0.09; // (0.3 m)² — umbral de proximidad en XZ
  type EndExt = { p1: number; p2: number };
  const wallExtensions = new Map<string, EndExt>();
  for (const w of wallObjs) wallExtensions.set(w.id, { p1: 0, p2: 0 });
  const wEndpoints = wallObjs.map((w) => ({
    id: w.id,
    axis: wallAxis(w),
    ...wallEndpointsXZ(w, center, pxPerMeter),
  }));
  for (let i = 0; i < wEndpoints.length; i++) {
    const a = wEndpoints[i]!;
    for (let j = i + 1; j < wEndpoints.length; j++) {
      const b = wEndpoints[j]!;
      for (const aEnd of ['p1', 'p2'] as const) {
        const pa = a[aEnd];
        for (const bEnd of ['p1', 'p2'] as const) {
          const pb = b[bEnd];
          const dx = pa[0] - pb[0], dz = pa[1] - pb[1];
          if (dx * dx + dz * dz > JUNCTION_THRESH2) continue;
          const sinTheta = Math.abs(
            a.axis.u[0] * b.axis.u[1] - a.axis.u[1] * b.axis.u[0],
          );
          if (sinTheta < 0.1) continue; // casi paralelos: sin extensión
          const eA = Math.min(1.5 * a.axis.t, b.axis.t / (2 * sinTheta));
          const eB = Math.min(1.5 * b.axis.t, a.axis.t / (2 * sinTheta));
          const extA = wallExtensions.get(a.id)!;
          const extB = wallExtensions.get(b.id)!;
          extA[aEnd] = Math.max(extA[aEnd], eA);
          extB[bEnd] = Math.max(extB[bEnd], eB);
        }
      }
    }
  }

  const walls: WallBox[] = [];
  const glassPanes: GlassPane[] = [];
  const openingFrames: OpeningFrame[] = [];
  for (const wall of wallObjs) {
    const ext = wallExtensions.get(wall.id) ?? { p1: 0, p2: 0 };
    const { boxes, panes, frames } = splitWallWithOpenings(
      wall,
      openingsByWall.get(wall.id) ?? [],
      ceilingHeightM,
      center,
      pxPerMeter,
      ext.p1,
      ext.p2,
    );
    // Anota cada caja con el id del muro de origen, propaga su color y su estado hidden.
    walls.push(
      ...boxes.map((b) => ({
        ...b,
        sourceId: wall.id,
        ...(wall.color ? { color: wall.color } : {}),
        ...(wall.hidden ? { hidden: true } : {}),
      })),
    );
    glassPanes.push(...panes);
    openingFrames.push(...frames);
  }

  // Suelo: bounding box de SOLO los muros (no de ventanas/puertas, que pueden sobresalir
  // del contorno por diseño y estirarían el suelo). Si no hay muros, cae a todos los objetos.
  // El bbox respeta la rotación de los muros (Draw Walls los rota), y el suelo se centra en
  // el centro de ESE bbox (no en el origen de la escena), que puede diferir si hay objetos
  // fuera del rectángulo de muros.
  const wallsForFloor = doc.objects.filter((o) => o.kind === 'wall');
  const ref = wallsForFloor.length > 0 ? wallsForFloor : doc.objects;
  const floor: FloorRect = (() => {
    if (ref.length === 0) return { size: [0, 0], center: [0, 0] };
    const bb = boundingBoxPx(ref);
    const floorCenterPx: [number, number] = [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2];
    const rect: FloorRect = {
      size: [
        pxToMeters(Math.max(0, bb.maxX - bb.minX), { pxPerMeter }),
        pxToMeters(Math.max(0, bb.maxY - bb.minY), { pxPerMeter }),
      ],
      center: [
        pxToMeters(floorCenterPx[0] - center[0], { pxPerMeter }),
        pxToMeters(floorCenterPx[1] - center[1], { pxPerMeter }),
      ],
    };
    // Suelo poligonal: el contorno se DERIVA de los muros ACTUALES (huella encerrada por
    // ellos), de modo que el 3D sigue siempre al 2D aunque el usuario edite muros. Solo si
    // esa derivación no es posible (pocos muros, huella degenerada) se cae al `floorOutline`
    // del doc (foto al crear la sala) y, en último término, al suelo rectangular del bbox.
    // El `size`/`center` rectangular se conservan (cámara y grid los usan). Mapeo px→XZ
    // relativo al centro de la escena (X-2D→X, Y-2D→Z), igual que los muros.
    const toXZ = (p: { x: number; y: number }): [number, number] => [
      pxToMeters(p.x - center[0], { pxPerMeter }),
      pxToMeters(p.y - center[1], { pxPerMeter }),
    ];
    const derived = floorPolygonFromWalls(wallsForFloor);
    if (derived && derived.length >= 3) {
      return { ...rect, polygon: derived.map(toXZ) };
    }
    const outline = doc.floorOutline;
    if (outline && outline.length >= 3) {
      return { ...rect, polygon: outline.map(toXZ) };
    }
    return rect;
  })();

  return {
    floor,
    walls,
    glassPanes,
    openingFrames,
    furniture,
    ceilingItems,
    lights,
    ceilingHeightM,
    pxPerMeter,
    planCenterPx: center,
  };
}

