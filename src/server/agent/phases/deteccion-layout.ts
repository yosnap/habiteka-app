/**
 * Detección de layout desde foto/boceto (F5, BETA): la IA reconoce elementos y su
 * posición (bbox normalizada) para poblar el plano como objetos editables.
 *
 * A diferencia de `ingesta.ts` (que solo CUENTA elementos), aquí se piden
 * POSICIONES. La detección de bbox sobre foto en perspectiva es imprecisa (de ahí
 * la etiqueta BETA); el validador es la frontera de confianza: solo pasan kinds
 * del catálogo con bbox dentro de [0,1]. Piezas puras testeables sin red ni IA.
 */
import type {
  ChatVisionAdapter,
  DetectedObject,
  JsonSchema,
  MessagePart,
} from '@/lib/contracts';
import type { StructKind } from '@/canvas/types';
import { CATALOG_BY_KIND } from '@/canvas/catalog';

// El mapeo bbox→px es puro y cliente-safe (lo usa también la UI); vive en canvas/.
export { detectedToObjects } from '@/canvas/detected-layout';

/** Esquema de salida: lista de elementos con kind y bbox normalizada 0–1. */
export const DETECTED_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['elementos'],
  properties: {
    elementos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'x', 'y', 'w', 'h'],
        properties: {
          kind: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          w: { type: 'number' },
          h: { type: 'number' },
          confianza: { type: 'number' },
        },
      },
    },
  },
};

const inUnit = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;

/**
 * Valida la salida del modelo: solo elementos con kind del catálogo y bbox dentro
 * de [0,1]. Descarta (no falla) lo inválido, para no poblar el plano con basura.
 */
export function parseDetected(structured: unknown): DetectedObject[] {
  if (typeof structured !== 'object' || structured === null) return [];
  const list = (structured as { elementos?: unknown }).elementos;
  if (!Array.isArray(list)) return [];
  const out: DetectedObject[] = [];
  for (const e of list) {
    if (typeof e !== 'object' || e === null) continue;
    const { kind, x, y, w, h, confianza } = e as Record<string, unknown>;
    if (typeof kind !== 'string' || !(kind in CATALOG_BY_KIND)) continue;
    // La bbox debe caber dentro de la imagen (origen en unidad + tamaño positivo).
    if (!inUnit(x) || !inUnit(y) || !inUnit(w) || !inUnit(h) || w <= 0 || h <= 0) continue;
    if (x + w > 1.0001 || y + h > 1.0001) continue;
    out.push({
      kind: kind as StructKind,
      bbox: { x, y, w, h },
      ...(typeof confianza === 'number' && Number.isFinite(confianza) ? { confianza } : {}),
    });
  }
  return out;
}

/** Prompt (puro) de la detección con posiciones. */
export function detectionPrompt(): string {
  return [
    'Analiza esta imagen de un espacio o plano de vivienda y DETECTA sus elementos con su',
    'POSICIÓN. Para cada elemento devuelve: kind (uno de: muros, puertas, ventanas, y mobiliario',
    'si lo hubiera), y su bounding box NORMALIZADA respecto a la imagen: x, y (esquina superior',
    'izquierda) y w, h (ancho, alto), todos entre 0 y 1. Funciona mejor con planos en planta',
    '(vista cenital). Devuelve solo la lista de elementos detectados.',
  ].join('\n');
}

/** Pide la detección al modelo de visión y devuelve los elementos válidos. */
export async function detectLayout(
  chat: ChatVisionAdapter,
  imageParts: MessagePart[],
): Promise<DetectedObject[]> {
  const result = await chat.chat({
    model: '',
    messages: [{ role: 'user', content: [{ type: 'text', text: detectionPrompt() }, ...imageParts] }],
    responseSchema: DETECTED_SCHEMA,
  });
  return parseDetected(result.structured);
}
