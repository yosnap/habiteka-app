import type { Opening } from './schema';
import type { DoorHandle, FrameFinish, LeafDesign, LeafFinish } from './opening-look-options';

/** Cómo se mueve la hoja: decide el símbolo 2D, el modelo 3D y el espacio que reserva en planta. */
export type OpeningOperation =
  /** Hojas sobre bisagras: barren un arco. */
  | 'abatible'
  /** Hoja vista que se desliza por una cara del muro: no barre arco, recorre la pared. */
  | 'corredera'
  /** La hoja entra en un cajón dentro del muro (casoneto). */
  | 'corredera-empotrada'
  /** Dos hojas que se cruzan dentro del marco, como una ventana corredera. */
  | 'corredera-marco'
  /** Paneles en acordeón que se pliegan junto a un lado. */
  | 'plegable'
  /** Vidrio fijo sin hoja practicable. */
  | 'fija'
  /** Puerta de garaje seccional: los paneles suben y se recogen bajo el techo, hacia dentro. */
  | 'seccional'
  /** Cierre enrollable de lamas que se recoge en un cajón sobre el hueco (garaje o local). */
  | 'enrollable'
  /** Puerta basculante: una sola hoja rígida que bascula hasta quedar horizontal, en parte por fuera. */
  | 'basculante'
  /** Ventana de guillotina: dos hojas que se deslizan en vertical, una delante de otra. */
  | 'guillotina'
  /** Ventana histórica: marco, montante central y vidrio. */
  | 'generica';

export type OpeningTypeKind = 'puerta' | 'ventana';

/** Apartado de las puertas en Construir: con tantos tipos, se agrupan por uso. */
export type OpeningTypeGroup = 'interior' | 'entrada' | 'correderas' | 'exterior';
export const OPENING_TYPE_GROUP_NAMES: Readonly<Record<OpeningTypeGroup, string>> = {
  interior: 'Interior', entrada: 'Entrada', correderas: 'Correderas', exterior: 'Exterior y garaje',
};

export interface OpeningType {
  id: string;
  kind: OpeningTypeKind;
  name: string;
  operation: OpeningOperation;
  widthMm: number;
  heightMm: number;
  /** Cota sobre el suelo de la estancia del muro. */
  elevationMm: number;
  /** Hojas o paneles; en una plegable, los paneles del acordeón. */
  leaves: number;
  /** Barre un arco de giro como una hoja abatible. Correderas y plegables no. */
  swings: boolean;
  /** Hoja o paño acristalado. */
  glazed: boolean;
  leafThicknessMm: number;
  /** Ancho máximo del marco: la puerta blindada lleva un premarco más robusto. */
  frameMm: number;
  /** Ancho máximo real del tipo, en milímetros. */
  maxWidthMm: number;
  /** Tipo anterior al diseño y al acabado: sin esos campos conserva la hoja, el color y la ausencia de tirador de siempre. */
  legacy?: boolean;
  /** Aspecto con el que se coloca desde el catálogo y que enseña su foto. */
  look: OpeningLookDefaults;
  /** Pivotante: distancia del eje al canto de la hoja, como fracción de su largo. */
  pivotRatio?: number;
  /** Hoja y media: fracción del ancho de la hoja principal; la otra queda fija. */
  mainLeafRatio?: number;
  /** Vaivén: la hoja abre hacia las dos caras del muro. */
  doubleActing?: boolean;
  /** Hoja de vidrio templado sin bastidor, con herrajes vistos. */
  frameless?: boolean;
  /** Corredera de granero: guía y ruedas vistas sobre la hoja. */
  barn?: boolean;
  /** Puerta de entrada: mirilla, y el pomo se monta centrado en la cara exterior. */
  entrance?: boolean;
  /** Oscilobatiente: además de girar, bascula sobre su lado inferior. */
  tilt?: boolean;
  /** Ventana con fijo superior: alto del montante de vidrio sobre las hojas. */
  transomMm?: number;
}

export interface OpeningLookDefaults { design?: LeafDesign; finish?: LeafFinish; handle?: DoorHandle; frameFinish?: FrameFinish }

const doorType = (id: string, name: string, operation: OpeningOperation, widthMm: number, maxWidthMm: number,
  look: OpeningLookDefaults, extra: Partial<OpeningType> = {}): OpeningType => ({
  id, kind: 'puerta', name, operation, widthMm, heightMm: 2100, elevationMm: 0, leaves: 1,
  swings: operation === 'abatible', glazed: false, leafThicknessMm: 38, frameMm: 45, maxWidthMm, look, ...extra,
});
const windowType = (id: string, name: string, operation: OpeningOperation, widthMm: number, maxWidthMm: number,
  frameFinish: FrameFinish, extra: Partial<OpeningType> = {}): OpeningType => ({
  id, kind: 'ventana', name, operation, widthMm, heightMm: 1200, elevationMm: 900, leaves: 1,
  swings: operation === 'abatible', glazed: true, leafThicknessMm: 50, frameMm: 45, maxWidthMm, look: { frameFinish }, ...extra,
});
const historic = (types: OpeningType[]) => types.map((type): OpeningType => ({ ...type, legacy: true }));

/**
 * Registro único de tipos de puerta y ventana. Los `-basic` reproducen el modelo histórico: un documento sin
 * `catalogId` (o con uno desconocido) se resuelve a ellos y se ve exactamente igual que antes. Los tipos históricos
 * (`legacy`) conservan su hoja, su color y su falta de tirador mientras el documento no elija diseño ni acabado.
 */
export const OPENING_TYPES: readonly OpeningType[] = [
  ...historic([
    doorType('puerta-basic', 'Puerta abatible', 'abatible', 900, 1250, { design: 'lisa', finish: 'lacado-blanco', handle: 'manilla' }),
    doorType('puerta-entrada', 'Puerta de entrada blindada', 'abatible', 950, 1200, { design: 'molduras-4', finish: 'nogal', handle: 'pomo' },
      { leafThicknessMm: 70, frameMm: 70, entrance: true }),
    doorType('puerta-doble', 'Puerta de dos hojas', 'abatible', 1400, 1800, { design: 'molduras-2', finish: 'lacado-blanco', handle: 'manilla' }, { leaves: 2 }),
    doorType('puerta-vidriera', 'Puerta vidriera', 'abatible', 900, 1250, { design: 'vidrio', finish: 'roble', handle: 'manilla' }, { glazed: true }),
    doorType('puerta-corredera', 'Puerta corredera vista', 'corredera', 900, 1400, { design: 'lisa', finish: 'roble', handle: 'tirador' }, { leafThicknessMm: 40 }),
    doorType('puerta-corredera-empotrada', 'Puerta corredera empotrada', 'corredera-empotrada', 800, 1200,
      { design: 'franja-vidrio', finish: 'lacado-blanco', handle: 'ninguno' }),
    doorType('puerta-corredera-vidrio', 'Corredera de vidrio a patio o terraza', 'corredera-marco', 1800, 3200, { frameFinish: 'aluminio-antracita' },
      { leaves: 2, glazed: true, leafThicknessMm: 50, frameMm: 60 }),
    doorType('puerta-plegable', 'Puerta plegable (acordeón)', 'plegable', 800, 2400, { design: 'lamas', finish: 'lacado-blanco', handle: 'ninguno' },
      { leaves: 4, leafThicknessMm: 25 }),
  ]),
  doorType('puerta-granero', 'Corredera de granero', 'corredera', 1000, 1500, { design: 'ranurada', finish: 'roble', handle: 'tirador' },
    { leafThicknessMm: 40, barn: true }),
  doorType('puerta-corredera-central', 'Corredera de dos hojas al centro', 'corredera', 1400, 2400,
    { design: 'vidrio-cuadriculado', finish: 'lacado-blanco', handle: 'tirador' }, { leaves: 2, leafThicknessMm: 40 }),
  doorType('puerta-corredera-elevadora', 'Corredera elevadora de cuatro hojas a patio o terraza', 'corredera-marco', 3200, 4000,
    { frameFinish: 'aluminio-antracita' }, { leaves: 4, glazed: true, heightMm: 2200, leafThicknessMm: 60, frameMm: 70 }),
  doorType('puerta-pivotante', 'Puerta pivotante', 'abatible', 1100, 1600, { design: 'lisa', finish: 'nogal', handle: 'tirador' },
    { heightMm: 2400, leafThicknessMm: 60, frameMm: 50, pivotRatio: .2 }),
  doorType('puerta-cristal', 'Puerta de cristal templado', 'abatible', 900, 1100, { handle: 'tirador' },
    { glazed: true, frameless: true, leafThicknessMm: 10, frameMm: 40 }),
  doorType('puerta-entrada-hoja-media', 'Puerta de entrada de hoja y media', 'abatible', 1200, 1500,
    { design: 'ranurada', finish: 'antracita', handle: 'tirador' }, { leaves: 2, mainLeafRatio: .7, leafThicknessMm: 70, frameMm: 70, entrance: true }),
  doorType('puerta-vaiven', 'Puerta de vaivén', 'abatible', 800, 1000, { design: 'franja-vidrio', finish: 'roble', handle: 'ninguno' },
    { leafThicknessMm: 40, doubleActing: true }),
  doorType('puerta-garaje', 'Puerta de garaje seccional', 'seccional', 2500, 5000, { finish: 'antracita' },
    { heightMm: 2125, leafThicknessMm: 45, frameMm: 60 }),
  doorType('puerta-garaje-enrollable', 'Puerta enrollable (garaje o local)', 'enrollable', 2500, 5000, { finish: 'lacado-blanco' },
    { heightMm: 2200, leafThicknessMm: 20, frameMm: 60 }),
  doorType('puerta-garaje-basculante', 'Puerta de garaje basculante', 'basculante', 2500, 5000, { finish: 'roble' },
    { heightMm: 2100, leafThicknessMm: 45, frameMm: 60 }),
  doorType('puerta-garaje-corredera', 'Puerta de garaje corredera lateral', 'corredera', 2500, 5000,
    { design: 'ranurada', finish: 'negro', handle: 'tirador' }, { heightMm: 2100, leafThicknessMm: 45, frameMm: 60 }),
  doorType('puerta-exterior-corredera', 'Portón exterior corredero en pared', 'corredera', 3000, 6000,
    { design: 'lamas', finish: 'antracita', handle: 'tirador', frameFinish: 'aluminio-antracita' },
    { heightMm: 2000, leafThicknessMm: 60, frameMm: 60 }),
  doorType('puerta-garaje-batiente', 'Puerta de garaje batiente de dos hojas', 'abatible', 2500, 5000,
    { design: 'molduras-4', finish: 'nogal', handle: 'manilla' }, { leaves: 2, heightMm: 2100, leafThicknessMm: 45, frameMm: 60 }),
  ...historic([
    windowType('ventana-basic', 'Ventana', 'generica', 1200, 2600, 'pvc-blanco', { leaves: 2 }),
    windowType('ventana-abatible', 'Ventana abatible de una hoja', 'abatible', 600, 900, 'pvc-blanco'),
    windowType('ventana-abatible-doble', 'Ventana abatible de dos hojas', 'abatible', 1200, 1800, 'pvc-blanco', { leaves: 2 }),
    windowType('ventana-corredera', 'Ventana corredera', 'corredera-marco', 1200, 3000, 'aluminio-antracita', { leaves: 2 }),
    windowType('ventana-balconera', 'Balconera (hasta el suelo)', 'abatible', 1200, 1800, 'madera', { leaves: 2, heightMm: 2100, elevationMm: 0 }),
    windowType('ventana-fija', 'Ventana fija', 'fija', 1000, 3000, 'aluminio-antracita'),
  ]),
  windowType('ventana-oscilobatiente', 'Ventana oscilobatiente', 'abatible', 800, 1200, 'pvc-blanco', { tilt: true }),
  windowType('ventana-guillotina', 'Ventana de guillotina', 'guillotina', 900, 1500, 'pvc-blanco', { heightMm: 1500 }),
  windowType('ventana-tres-hojas', 'Ventana de tres hojas', 'abatible', 1800, 2700, 'pvc-blanco', { leaves: 3 }),
  windowType('ventana-montante', 'Ventana con fijo superior (montante)', 'abatible', 1200, 1800, 'aluminio-antracita',
    { leaves: 2, heightMm: 1600, elevationMm: 700, transomMm: 450 }),
  windowType('ventana-fija-suelo', 'Ventanal fijo hasta el suelo', 'fija', 1500, 4000, 'aluminio-antracita', { heightMm: 2100, elevationMm: 0 }),
];

const BY_ID = new Map(OPENING_TYPES.map((type) => [type.id, type]));

/** Apartado de cada puerta en Construir. */
const DOOR_GROUPS: Readonly<Record<string, OpeningTypeGroup>> = {
  'puerta-basic': 'interior', 'puerta-doble': 'interior', 'puerta-vidriera': 'interior', 'puerta-plegable': 'interior',
  'puerta-pivotante': 'interior', 'puerta-cristal': 'interior', 'puerta-vaiven': 'interior',
  'puerta-entrada': 'entrada', 'puerta-entrada-hoja-media': 'entrada',
  'puerta-corredera': 'correderas', 'puerta-corredera-empotrada': 'correderas', 'puerta-granero': 'correderas',
  'puerta-corredera-central': 'correderas',
};
export const openingTypeGroup = (type: OpeningType): OpeningTypeGroup | null =>
  type.kind === 'puerta' ? DOOR_GROUPS[type.id] ?? 'exterior' : null;

/** Puertas de garaje que se recogen hacia arriba (seccional, enrollable, basculante): se ven cerradas desde la calle. */
export const liftsOverhead = (type: OpeningType | null) =>
  type?.operation === 'seccional' || type?.operation === 'enrollable' || type?.operation === 'basculante';

export const basicOpeningTypeId = (kind: OpeningTypeKind) => `${kind}-basic`;

export function openingTypesFor(kind: OpeningTypeKind): OpeningType[] {
  return OPENING_TYPES.filter((type) => type.kind === kind);
}

/**
 * Tipo efectivo de una puerta o ventana. Un id ajeno a su clase (una ventana con `puerta-doble` tras una edición
 * en bloque) o desconocido cae en el básico: así nunca se pierde la abertura. Un hueco no tiene tipo.
 */
export function openingType(opening: Pick<Opening, 'kind' | 'catalogId'>): OpeningType | null {
  if (opening.kind === 'hueco') return null;
  const found = opening.catalogId ? BY_ID.get(opening.catalogId) : undefined;
  return found && found.kind === opening.kind ? found : BY_ID.get(basicOpeningTypeId(opening.kind))!;
}

/** El tipo histórico conserva su dibujo y su modelo de siempre. */
export const isBasicOpeningType = (type: OpeningType) => type.id === basicOpeningTypeId(type.kind);

/** Fracción de apertura de correderas y plegables: 90° en el documento equivale a abierta del todo. */
export const openFraction = (openAngleDeg: number) => Math.max(0, Math.min(1, openAngleDeg / 90));

/**
 * Cuánto se aleja la hoja de la cara del muro al abrir: una abatible, su ancho (la mitad si son dos hojas); una
 * plegable, un panel; una corredera vista, su grosor; una empotrada o en marco no sale del muro.
 */
export function leafReachMm(opening: Pick<Opening, 'kind' | 'catalogId' | 'widthMm'>): number {
  const type = openingType(opening);
  switch (type?.operation) {
    case 'abatible':
      // Hoja y media: la principal; pivotante: el tramo de hoja al otro lado del eje; ventana de tres hojas, un tercio.
      if (type.mainLeafRatio) return opening.widthMm * type.mainLeafRatio;
      if (type.pivotRatio) return opening.widthMm * (1 - type.pivotRatio);
      return opening.widthMm / Math.min(Math.max(1, type.leaves), 3);
    case 'plegable': return opening.widthMm / Math.max(2, type.leaves);
    case 'corredera': return type.leafThicknessMm + (type.barn ? 30 : 10);
    default: return 0;
  }
}

/**
 * Tramo de pared que ocupa la hoja de una corredera vista al abrirse, antes del inicio y después del final del hueco
 * según el muro orientado: una hoja se recoge entera hacia el lado de su «bisagra»; dos hojas al centro, media a cada lado.
 */
export function slideParkingMm(opening: Pick<Opening, 'kind' | 'catalogId' | 'widthMm' | 'hinge'>): { start: number; end: number } {
  const type = openingType(opening);
  if (type?.operation !== 'corredera') return { start: 0, end: 0 };
  if (type.leaves >= 2) return { start: opening.widthMm / 2, end: opening.widthMm / 2 };
  return (opening.hinge ?? 'left') === 'left' ? { start: opening.widthMm, end: 0 } : { start: 0, end: opening.widthMm };
}

/** Las medidas reales de cada tipo tienen un máximo: una puerta abatible no llega a 2 m ni una pivotante a 3 m. */
export function assertOpeningTypeWidth(type: OpeningType | null, widthMm: number): void {
  if (type && widthMm > type.maxWidthMm + .5)
    throw new Error(`${type.name}: admite como máximo ${(type.maxWidthMm / 1000).toFixed(2).replace('.', ',')} m de ancho.`);
}

/** Controles que tienen sentido para cada tipo en Propiedades y en el menú contextual; `null` oculta el botón. */
export interface OpeningControls {
  /** Ángulo de apertura editable: solo las hojas que giran. */
  angle: boolean;
  /** Abrir o cerrar: correderas y plegables se recogen; las abatibles giran 90°. */
  toggle: boolean;
  hinge: string | null;
  swing: string | null;
}

export function openingControls(type: OpeningType | null): OpeningControls {
  const none: OpeningControls = { angle: false, toggle: false, hinge: null, swing: null };
  if (!type) return none;
  // Hoja y media: la bisagra elige el lado de la hoja principal; en dos o tres hojas iguales no hay lado que elegir.
  const hinged = { hinge: type.leaves >= 2 && !type.mainLeafRatio ? null : 'Cambiar bisagra', swing: 'Invertir apertura' };
  // Los paños de ventana no se abren en el modelo: solo cambia hacia qué cara se dibujan.
  if (type.kind === 'ventana') return type.operation === 'abatible' ? { ...none, ...hinged } : none;
  switch (type.operation) {
    case 'abatible': return { angle: true, toggle: true, ...hinged };
    case 'corredera': return { angle: false, toggle: true, hinge: type.leaves >= 2 ? null : 'Cambiar lado de apertura', swing: 'Cambiar cara del muro' };
    case 'plegable': return { angle: false, toggle: true, hinge: 'Cambiar lado de plegado', swing: 'Invertir apertura' };
    // Las de garaje que suben se montan por dentro: se elige la cara del muro hacia la que se recogen.
    case 'seccional': case 'enrollable': case 'basculante': return { angle: false, toggle: true, hinge: null, swing: 'Cambiar cara del muro' };
    default: return { angle: false, toggle: true, hinge: type.leaves >= 4 ? null : 'Cambiar lado de apertura', swing: null };
  }
}
