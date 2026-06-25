/**
 * Recomendación de decoración (F4): la IA propone elementos del catálogo para
 * enriquecer el plano según objetivo + estilo + lo ya colocado. Las piezas puras
 * (prompt, schema, validador) viven aquí y son testeables sin red ni IA.
 *
 * El validador es la frontera de confianza: la IA puede devolver kinds inventados
 * o posiciones absurdas; solo pasan los `kind` del catálogo con posición finita.
 */
import type { ChatVisionAdapter, DecorRecommendation, Estilo, JsonSchema } from '@/lib/contracts';
import { estiloLabel } from '@/lib/design-options';
import { CATALOG } from '@/canvas/catalog';

/** Kinds que tiene sentido RECOMENDAR como decoración (no estructura). */
const DECOR_KINDS = CATALOG.filter((c) => c.id === 'decoracion' || c.id === 'mobiliario').flatMap(
  (c) => c.items.map((i) => i.kind),
);
/** Conjunto para validar en O(1) que un kind sugerido está dentro del scope. */
const DECOR_KIND_SET = new Set<string>(DECOR_KINDS);

/** Prompt (puro) que pide recomendaciones de decoración para el plano descrito. */
export function decorRecommendationPrompt(
  estilo: Estilo,
  objetivo: string,
  planoDescription: string,
): string {
  const objetivoTxt = objetivo.trim() ? ` con el objetivo "${objetivo.trim()}"` : '';
  return [
    `Eres un interiorista. Para este plano de estilo ${estiloLabel(estilo)}${objetivoTxt}, recomienda`,
    `entre 2 y 4 elementos de decoración que mejorarían el espacio.`,
    '',
    'Plano actual (vista en planta):',
    planoDescription,
    '',
    `Usa SOLO estos tipos (kind): ${DECOR_KINDS.join(', ')}.`,
    `Para cada uno da: kind, una posición (x, y) en píxeles dentro del plano, y un motivo breve`,
    `(p. ej. "una alfombra bajo la mesa para definir la zona de estar"). Devuelve JSON.`,
  ].join('\n');
}

/** Esquema de salida estructurada para las recomendaciones. */
export const DECOR_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['recomendaciones'],
  properties: {
    recomendaciones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'x', 'y', 'motivo'],
        properties: {
          kind: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          motivo: { type: 'string' },
        },
      },
    },
  },
};

/**
 * Valida la salida del modelo: solo recomendaciones con un `kind` del catálogo y
 * posición finita. Descarta (no falla) lo que no cumpla, para no insertar basura.
 */
export function parseRecommendations(structured: unknown): DecorRecommendation[] {
  if (typeof structured !== 'object' || structured === null) return [];
  const list = (structured as { recomendaciones?: unknown }).recomendaciones;
  if (!Array.isArray(list)) return [];
  const out: DecorRecommendation[] = [];
  for (const r of list) {
    if (typeof r !== 'object' || r === null) continue;
    const { kind, x, y, motivo } = r as Record<string, unknown>;
    // Solo kinds DENTRO del scope ofrecido en el prompt (decoración/mobiliario):
    // el modelo no debe colar estructura (muro/puerta) ni focos como "decoración".
    if (typeof kind !== 'string' || !DECOR_KIND_SET.has(kind)) continue;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    out.push({
      kind: kind as DecorRecommendation['kind'],
      x,
      y,
      motivo: typeof motivo === 'string' ? motivo : '',
    });
  }
  return out;
}

/** Pide recomendaciones al chat y devuelve las válidas (puede ser lista vacía). */
export async function recommendDecoration(
  chat: ChatVisionAdapter,
  estilo: Estilo,
  objetivo: string,
  planoDescription: string,
): Promise<DecorRecommendation[]> {
  const result = await chat.chat({
    model: '',
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: decorRecommendationPrompt(estilo, objetivo, planoDescription) }],
      },
    ],
    responseSchema: DECOR_SCHEMA,
  });
  return parseRecommendations(result.structured);
}
