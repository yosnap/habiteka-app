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
import type { RawSketch, SketchAperture, SketchRoom, SketchWall } from './sketch-types';

const APERTURE_KINDS = ['puerta', 'ventana', 'hueco'] as const;

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
          poligono: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['x', 'y'],
              properties: { x: { type: 'number' }, y: { type: 'number' } },
            },
          },
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
    '- muros: cada tramo recto de pared como segmento con extremos (x1,y1)-(x2,y2) en',
    '  coordenadas NORMALIZADAS 0–1 respecto a la imagen. Sigue la intención del trazo:',
    '  si una línea pretende ser recta u ortogonal aunque esté torcida, devuélvela como el',
    '  segmento que el autor quería dibujar. Los muros que se tocan deben COMPARTIR extremos.',
    '- aberturas: puertas, ventanas y huecos de paso, cada una anclada a su muro por índice,',
    '  con su centro como fracción 0–1 a lo largo del muro y su ancho como fracción de la',
    '  longitud del muro.',
    '- habitaciones: cada estancia con su nombre (el rotulado en el boceto, o dedúcelo del',
    '  mobiliario dibujado) y su contorno como polígono normalizado.',
    '- anchoMetros/altoMetros: solo si el boceto tiene cotas, medidas escritas o escala deducible.',
    '',
    'No inventes elementos que no estén dibujados. Ignora mobiliario, texto decorativo y sombras.',
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
    const { tipo, muro, posicion, anchoSobreMuro } = a as Record<string, unknown>;
    if (typeof tipo !== 'string' || !APERTURE_KINDS.includes(tipo as (typeof APERTURE_KINDS)[number]))
      continue;
    if (typeof muro !== 'number' || !Number.isInteger(muro) || muro < 0 || muro >= wallCount)
      continue;
    if (!isUnit(posicion)) continue;
    out.push({
      tipo: tipo as SketchAperture['tipo'],
      muro,
      posicion,
      ...(isUnit(anchoSobreMuro) && anchoSobreMuro > 0 ? { anchoSobreMuro } : {}),
    });
  }
  return out;
}

function parseRooms(list: unknown): SketchRoom[] {
  if (!Array.isArray(list)) return [];
  const out: SketchRoom[] = [];
  for (const r of list) {
    if (typeof r !== 'object' || r === null) continue;
    const { nombre, poligono } = r as Record<string, unknown>;
    if (typeof nombre !== 'string' || nombre.trim() === '') continue;
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
    out.push({ nombre: nombre.trim().slice(0, 60), poligono: points.map(({ x, y }) => ({ x, y })) });
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
    muros,
    aberturas: parseApertures(s.aberturas, muros.length),
    habitaciones: parseRooms(s.habitaciones),
  };
}

/** Pide la extracción al modelo de visión y devuelve la geometría validada. */
export async function extractSketchGeometry(
  chat: ChatVisionAdapter,
  imageParts: MessagePart[],
): Promise<RawSketch> {
  const result = await chat.chat({
    // El modelo real lo resuelve la ruta de la acción `vision` (config del admin).
    model: '',
    messages: [{ role: 'user', content: [{ type: 'text', text: sketchPrompt() }, ...imageParts] }],
    responseSchema: SKETCH_SCHEMA,
    // La geometría de un boceto con muchos muros es un JSON largo, y los modelos
    // con razonamiento gastan parte del presupuesto en pensar: con el tope por
    // defecto el JSON puede salir truncado (y no valida contra el schema).
    maxTokens: 8192,
  });
  return parseRawSketch(result.structured);
}
