/**
 * Extracción de geometría desde un boceto (foto de dibujo a mano o croquis).
 *
 * La IA solo ENTIENDE el boceto (visión → JSON estructurado); nunca dibuja el
 * plano. El validador es la frontera de confianza: descarta (sin fallar) todo
 * lo que no cumpla el contrato — coordenadas fuera de [0,1], índices de muro
 * inexistentes, polígonos degenerados — para no propagar geometría basura al
 * normalizador. Piezas puras testeables sin red ni IA.
 *
 * Usa la acción de modelo `vision` (configurable desde el back-office), igual
 * que la detección de layout: no hay modelos hardcodeados en este módulo.
 */
import type { ChatVisionAdapter, JsonSchema, MessagePart } from '@/lib/contracts';
import {
  SKETCH_FURNITURE_KINDS,
  type RawSketch,
  type SketchAperture,
  type SketchDimension,
  type SketchFurniture,
  type SketchRoom,
  type SketchWall,
} from './sketch-types';
import { sanitizeExtractedText } from './sanitize-extracted-text';
import { validDoorArcGeometry } from './door-arc-geometry';

const APERTURE_KINDS = ['puerta', 'ventana', 'hueco'] as const;

const POINT_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y'],
  properties: { x: { type: 'number' }, y: { type: 'number' } },
};

/** Esquema de salida: muros como segmentos, aberturas ancladas y habitaciones. */
export const SKETCH_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['muros', 'aberturas', 'habitaciones'],
  properties: {
    anchoMetros: {
      type: 'number',
      description: 'Ancho real total del plano en metros, si el boceto lo indica o es deducible.',
    },
    altoMetros: {
      type: 'number',
      description: 'Alto real total del plano en metros, si es deducible.',
    },
    escalaFiable: {
      type: 'boolean',
      description:
        'true SOLO si el boceto contiene cotas o medidas escritas de las que sale la escala; false si anchoMetros/altoMetros son una estimación.',
    },
    muros: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['x1', 'y1', 'x2', 'y2'],
        properties: {
          x1: { type: 'number' },
          y1: { type: 'number' },
          x2: { type: 'number' },
          y2: { type: 'number' },
        },
      },
    },
    aberturas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'muro', 'posicion'],
        properties: {
          tipo: { type: 'string', enum: [...APERTURE_KINDS] },
          muro: { type: 'number', description: 'Índice del muro en la lista `muros`.' },
          posicion: {
            type: 'number',
            description: 'Centro de la abertura a lo largo del muro, 0–1 desde (x1,y1).',
          },
          anchoSobreMuro: {
            type: 'number',
            description: 'Ancho de la abertura como fracción de la longitud del muro (0–1).',
          },
          swing: { type: 'string', enum: ['left', 'right'], description: 'Solo para puertas: lado del arco de barrido respecto al muro orientado (x1,y1)→(x2,y2): left = normal positiva (-dy,dx); right = lado opuesto. Omite si no se ve.' },
          hinge: { type: 'string', enum: ['left', 'right'], description: 'Solo para puertas: bisagra en el extremo inicial (left) o final (right) del hueco, según el muro orientado. Omite si no se ve.' },
          arcVisible: { type: 'boolean', description: 'true solo si se ve el arco de barrido de la hoja de esta puerta; un hueco sin arco se clasifica como hueco.' },
          arcGeometry: {
            type: 'object', additionalProperties: false,
            required: ['hinge', 'openingEnd', 'arcPoint'],
            description: 'Tres puntos medidos en la imagen para una puerta con arco visible.',
            properties: {
              hinge: POINT_SCHEMA, openingEnd: POINT_SCHEMA, arcPoint: POINT_SCHEMA,
            },
          },
        },
      },
    },
    habitaciones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nombre', 'poligono'],
        properties: {
          nombre: { type: 'string' },
          poligono: { type: 'array', items: POINT_SCHEMA },
          exterior: {
            type: 'boolean',
            description: 'true si es terraza, patio, porche, jardín, loggia o cualquier espacio exterior.',
          },
          anchoMetros: { type: 'number', description: 'Ancho ESCRITO dentro de la estancia, en metros.' },
          altoMetros: { type: 'number', description: 'Alto ESCRITO dentro de la estancia, en metros.' },
          areaM2: { type: 'number', description: 'Superficie ESCRITA dentro de la estancia, en m².' },
        },
      },
    },
    cotas: {
      type: 'array',
      description: 'Rótulos de cota legibles en el plano (líneas de cota del contorno y medidas escritas).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['texto', 'valoresMetros', 'tipo', 'ancla'],
        properties: {
          texto: { type: 'string' },
          valoresMetros: { type: 'array', items: { type: 'number' } },
          tipo: { type: 'string', enum: ['general', 'estancia'] },
          ancla: POINT_SCHEMA,
        },
      },
    },
    mobiliario: {
      type: 'array',
      description: 'Muebles y aparatos dibujados en planta, con su caja normalizada 0–1.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'bbox', 'rotacionDeg'],
        properties: {
          tipo: { type: 'string', enum: [...SKETCH_FURNITURE_KINDS] },
          bbox: {
            type: 'object',
            additionalProperties: false,
            required: ['minX', 'minY', 'maxX', 'maxY'],
            properties: {
              minX: { type: 'number' }, minY: { type: 'number' },
              maxX: { type: 'number' }, maxY: { type: 'number' },
            },
          },
          rotacionDeg: { type: 'number', description: '0, 90, 180 o 270 según la orientación dibujada.' },
          etiqueta: { type: 'string' },
        },
      },
    },
  },
};

/** Prompt (puro) de la extracción de geometría de un boceto. */
export function sketchPrompt(): string {
  return [
    'La imagen es un BOCETO de un plano de vivienda en planta (vista cenital), posiblemente',
    'dibujado a mano con trazos imperfectos. Extrae su GEOMETRÍA:',
    '',
    '- muros: cada pared como UN ÚNICO segmento por su EJE CENTRAL, con extremos',
    '  (x1,y1)-(x2,y2) en coordenadas NORMALIZADAS 0–1 respecto a la imagen. Si el muro está',
    '  dibujado grueso (dos líneas paralelas), devuelve UNA sola línea por el centro, nunca las',
    '  dos caras. Usa el MENOR número de segmentos posible: una pared recta es UN segmento,',
    '  aunque tenga puertas o ventanas (no la trocees). Sigue la intención del trazo: si una',
    '  línea pretende ser recta u ortogonal aunque esté torcida, devuelve el segmento que el',
    '  autor quería dibujar. Los muros que se tocan deben COMPARTIR extremos.',
    '- aberturas: SOLO las puertas, ventanas y huecos de paso claramente dibujados, cada una',
    '  anclada a su muro por índice, con su centro como fracción 0–1 a lo largo del muro y su',
    '  ancho como fracción de la longitud del muro. En caso de duda, no la devuelvas.',
    '  Una PUERTA exige ver el arco de barrido de la hoja: marca arcVisible=true.',
    '  Si se ve, da arcGeometry: hinge=punto exacto de bisagra sobre el muro,',
    '  openingEnd=otro extremo del vano sobre ESE MISMO muro, arcPoint=un punto',
    '  del arco visible lejos del muro. Usa las coordenadas de la imagen 0–1;',
    '  estos puntos prevalecen sobre el índice de muro y los giros estimados.',
    '  Si solo ves un hueco sin arco, devuelve tipo=hueco; no inventes una puerta.',
    '  Para cada puerta, lee el ARCO dibujado: swing=left si abre hacia la normal',
    '  (-dy,dx) del muro orientado (x1,y1)→(x2,y2), right si abre al lado opuesto.',
    '  hinge=left si la bisagra está en el extremo inicial del hueco sobre ese muro,',
    '  right si está en el final. Omite swing/hinge si el arco o la bisagra no se ven;',
    '  no los deduzcas del nombre de la estancia.',
    '- habitaciones: cada estancia con su nombre (el rotulado en el boceto, o dedúcelo del',
    '  mobiliario dibujado) y su contorno como polígono normalizado.',
    '- anchoMetros/altoMetros: estima SIEMPRE el ancho y alto reales del plano completo, en',
    '  metros. Si hay cotas o medidas escritas, úsalas y devuelve escalaFiable=true. Si no,',
    '  deduce la escala de referencias estándar (una puerta mide ~0,8 m, un dormitorio 3–4 m',
    '  de lado, un baño ~2 m) y devuelve escalaFiable=false.',
    '',
    'No inventes elementos que no estén dibujados. Ignora mobiliario, texto decorativo y sombras.',
    'MUY IMPORTANTE: los ARCOS DE BARRIDO de las puertas (el cuarto de círculo que indica hacia',
    'dónde abre la hoja) NO son muros; no los devuelvas como muros. Cada muro debe llegar hasta',
    'el muro con el que se encuentra (esquinas y juntas en T cerradas, sin dejar huecos).',
  ].join('\n');
}

/**
 * Prompt (puro) para un PLANO DIBUJADO O CREADO (esquemático de arquitecto,
 * CAD exportado, borrador limpio): además de la geometría pide lo que un plano
 * técnico ya trae escrito — cotas, medidas por estancia, superficies, espacios
 * exteriores y mobiliario — para que el código pueda ajustar el plano a las
 * medidas reales y amueblarlo desde el catálogo.
 */
export function planPrompt(): string {
  return [
    sketchPrompt().replace(
      'Ignora mobiliario, texto decorativo y sombras.',
      'Ignora texto decorativo y sombras.',
    ),
    '',
    'La imagen es un PLANO DIBUJADO o CREADO (esquemático, CAD o borrador limpio), así que',
    'además extrae lo que trae escrito o dibujado:',
    '',
    '- habitaciones: marca exterior=true en terrazas, patios, porches, jardines y loggias. Si',
    '  dentro de la estancia hay una medida escrita del tipo "3,00 x 4,00 m", devuélvela en',
    '  anchoMetros (medida horizontal en la imagen) y altoMetros (vertical). Si hay una',
    '  superficie escrita ("10,5 m²"), devuélvela en areaM2. No inventes medidas.',
    '- cotas: cada rótulo numérico de cota que puedas leer, con su texto literal, sus valores en',
    '  metros, su tipo (general = línea de cota del contorno o de una fachada; estancia = medida',
    '  escrita dentro de una estancia) y el punto donde está el rótulo. Las cotas generales del',
    '  ancho y alto totales son las más importantes.',
    '- mobiliario: cada mueble o aparato reconocible (cama, sofá, mesa, sillas, armario, encimera',
    '  de cocina, fregadero, inodoro, lavabo, bañera, ducha, coche…) con su tipo del vocabulario,',
    '  su caja normalizada y su giro (0/90/180/270). Un grupo de sillas alrededor de una mesa son',
    '  elementos separados. Los arcos de puerta, las escaleras y los árboles no son mobiliario.',
    '- anchoMetros/altoMetros globales: si hay cotas generales o escala gráfica, calcúlalos con',
    '  ellas y devuelve escalaFiable=true.',
  ].join('\n');
}

const isUnit = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

const isPositive = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

function parseWalls(list: unknown): SketchWall[] {
  if (!Array.isArray(list)) return [];
  const out: SketchWall[] = [];
  for (const w of list) {
    if (typeof w !== 'object' || w === null) continue;
    const { x1, y1, x2, y2 } = w as Record<string, unknown>;
    if (!isUnit(x1) || !isUnit(y1) || !isUnit(x2) || !isUnit(y2)) continue;
    // Segmento degenerado (ambos extremos en el mismo punto): sin dirección útil.
    if (x1 === x2 && y1 === y2) continue;
    out.push({ x1, y1, x2, y2 });
  }
  return out;
}

function parseApertures(list: unknown, wallCount: number): SketchAperture[] {
  if (!Array.isArray(list)) return [];
  const out: SketchAperture[] = [];
  for (const a of list) {
    if (typeof a !== 'object' || a === null) continue;
    const { tipo, muro, posicion, anchoSobreMuro, swing, hinge, arcVisible, arcGeometry } = a as Record<string, unknown>;
    if (typeof tipo !== 'string' || !APERTURE_KINDS.includes(tipo as (typeof APERTURE_KINDS)[number]))
      continue;
    if (typeof muro !== 'number' || !Number.isInteger(muro) || muro < 0 || muro >= wallCount)
      continue;
    if (!isUnit(posicion)) continue;
    const observedArc = tipo === 'puerta' && arcVisible === true
      ? validDoorArcGeometry(arcGeometry) : null;
    out.push({
      tipo: tipo as SketchAperture['tipo'],
      muro,
      posicion,
      ...(isUnit(anchoSobreMuro) && anchoSobreMuro > 0 ? { anchoSobreMuro } : {}),
      ...(tipo === 'puerta' && (swing === 'left' || swing === 'right') ? { swing } : {}),
      ...(tipo === 'puerta' && (hinge === 'left' || hinge === 'right') ? { hinge } : {}),
      ...(tipo === 'puerta' && arcVisible === true ? { arcVisible: true } : {}),
      ...(observedArc ? { arcGeometry: observedArc } : {}),
    });
  }
  return out;
}

function parseRooms(list: unknown): SketchRoom[] {
  if (!Array.isArray(list)) return [];
  const out: SketchRoom[] = [];
  for (const r of list) {
    if (typeof r !== 'object' || r === null) continue;
    const { poligono, exterior, anchoMetros, altoMetros, areaM2 } = r as Record<string, unknown>;
    // El nombre lo escribió quien dibujó el plano: se sanea antes de guardarlo.
    const nombre = sanitizeExtractedText((r as Record<string, unknown>).nombre);
    if (nombre === '') continue;
    if (!Array.isArray(poligono)) continue;
    const points = poligono.filter(
      (p): p is { x: number; y: number } =>
        typeof p === 'object' &&
        p !== null &&
        isUnit((p as Record<string, unknown>).x) &&
        isUnit((p as Record<string, unknown>).y),
    );
    // Un contorno necesita al menos un triángulo para delimitar área.
    if (points.length < 3) continue;
    const ancho = parseRoomMeters(anchoMetros);
    const alto = parseRoomMeters(altoMetros);
    const area = parseRoomArea(areaM2);
    out.push({
      nombre,
      poligono: points.map(({ x, y }) => ({ x, y })),
      ...(exterior === true ? { exterior: true } : {}),
      ...(ancho !== undefined ? { anchoMetros: ancho } : {}),
      ...(alto !== undefined ? { altoMetros: alto } : {}),
      ...(area !== undefined ? { areaM2: area } : {}),
    });
  }
  return out;
}

// Medidas plausibles de una estancia (m) y de su superficie (m²).
const MIN_ROOM_METERS = 0.5;
const MAX_ROOM_METERS = 30;
const MAX_ROOM_AREA_M2 = 400;

function parseRoomMeters(n: unknown): number | undefined {
  return isPositive(n) && n >= MIN_ROOM_METERS && n <= MAX_ROOM_METERS ? n : undefined;
}

function parseRoomArea(n: unknown): number | undefined {
  return isPositive(n) && n <= MAX_ROOM_AREA_M2 ? n : undefined;
}

function parseDimensions(list: unknown): SketchDimension[] {
  if (!Array.isArray(list)) return [];
  const out: SketchDimension[] = [];
  for (const d of list) {
    if (typeof d !== 'object' || d === null) continue;
    const { valoresMetros, tipo, ancla } = d as Record<string, unknown>;
    const texto = sanitizeExtractedText((d as Record<string, unknown>).texto);
    if (texto === '') continue;
    if (tipo !== 'general' && tipo !== 'estancia') continue;
    if (!Array.isArray(valoresMetros)) continue;
    const valores = valoresMetros.filter(
      (v): v is number => isPositive(v) && v >= MIN_ROOM_METERS && v <= MAX_PLAUSIBLE_METERS,
    );
    if (valores.length === 0 || valores.length > 2) continue;
    if (typeof ancla !== 'object' || ancla === null) continue;
    const { x, y } = ancla as Record<string, unknown>;
    if (!isUnit(x) || !isUnit(y)) continue;
    out.push({ texto, valoresMetros: valores, tipo, ancla: { x, y } });
  }
  return out;
}

const FURNITURE_ROTATIONS = [0, 90, 180, 270];

function parseFurniture(list: unknown): SketchFurniture[] {
  if (!Array.isArray(list)) return [];
  const out: SketchFurniture[] = [];
  for (const f of list) {
    if (typeof f !== 'object' || f === null) continue;
    const { tipo, bbox, rotacionDeg } = f as Record<string, unknown>;
    if (typeof tipo !== 'string' || !SKETCH_FURNITURE_KINDS.includes(tipo as SketchFurniture['tipo']))
      continue;
    if (typeof bbox !== 'object' || bbox === null) continue;
    const { minX, minY, maxX, maxY } = bbox as Record<string, unknown>;
    if (!isUnit(minX) || !isUnit(minY) || !isUnit(maxX) || !isUnit(maxY)) continue;
    // Caja degenerada: sin extensión no hay mueble que colocar.
    if (maxX <= minX || maxY <= minY) continue;
    // El giro se cuantiza a 90°: un mueble en planta va paralelo a los muros.
    const rotation =
      typeof rotacionDeg === 'number' && Number.isFinite(rotacionDeg)
        ? (((Math.round(rotacionDeg / 90) * 90) % 360) + 360) % 360
        : 0;
    const etiqueta = sanitizeExtractedText((f as Record<string, unknown>).etiqueta);
    out.push({
      tipo: tipo as SketchFurniture['tipo'],
      bbox: { minX, minY, maxX, maxY },
      rotacionDeg: FURNITURE_ROTATIONS.includes(rotation) ? rotation : 0,
      ...(etiqueta !== '' ? { etiqueta } : {}),
    });
  }
  return out;
}

// Escala declarada fuera de este rango se trata como alucinación y se descarta.
const MIN_PLAUSIBLE_METERS = 1;
const MAX_PLAUSIBLE_METERS = 100;

function parseMeters(n: unknown): number | undefined {
  if (!isPositive(n)) return undefined;
  if (n < MIN_PLAUSIBLE_METERS || n > MAX_PLAUSIBLE_METERS) return undefined;
  return n;
}

/**
 * Valida la salida del modelo. Descarta (no falla) lo inválido: la extracción
 * puede quedar incompleta, pero nunca contiene geometría fuera de contrato.
 */
export function parseRawSketch(structured: unknown): RawSketch {
  const empty: RawSketch = { muros: [], aberturas: [], habitaciones: [] };
  if (typeof structured !== 'object' || structured === null) return empty;
  const s = structured as Record<string, unknown>;
  const muros = parseWalls(s.muros);
  const anchoMetros = parseMeters(s.anchoMetros);
  const altoMetros = parseMeters(s.altoMetros);
  return {
    ...(anchoMetros !== undefined ? { anchoMetros } : {}),
    ...(altoMetros !== undefined ? { altoMetros } : {}),
    // Solo se acepta la fiabilidad si además hay una escala que respaldarla.
    ...(s.escalaFiable === true && anchoMetros !== undefined ? { escalaFiable: true } : {}),
    muros,
    aberturas: parseApertures(s.aberturas, muros.length),
    habitaciones: parseRooms(s.habitaciones),
    ...(Array.isArray(s.cotas) ? { cotas: parseDimensions(s.cotas) } : {}),
    ...(Array.isArray(s.mobiliario) ? { mobiliario: parseFurniture(s.mobiliario) } : {}),
  };
}

/** Origen de la imagen: boceto a mano (geometría) o plano dibujado (geometría + cotas + mobiliario). */
export type SketchSource = 'boceto' | 'plano';

/** Pide la extracción al modelo de visión y devuelve la geometría validada. */
export async function extractSketchGeometry(
  chat: ChatVisionAdapter,
  imageParts: MessagePart[],
  source: SketchSource = 'boceto',
): Promise<RawSketch> {
  const prompt = source === 'plano' ? planPrompt() : sketchPrompt();
  const result = await chat.chat({
    // El modelo real lo resuelve la ruta de la acción `vision` (config del admin).
    model: '',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...imageParts] }],
    responseSchema: SKETCH_SCHEMA,
    // La geometría de un boceto con muchos muros es un JSON largo, y los modelos
    // con razonamiento gastan parte del presupuesto en pensar: con el tope por
    // defecto el JSON puede salir truncado (y no valida contra el schema).
    maxTokens: 8192,
  });
  return parseRawSketch(result.structured);
}
