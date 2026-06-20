/**
 * Fase de ingesta: análisis visual del espacio aportado por el usuario.
 *
 * Pide al modelo de visión los elementos estructurales (muros, ventanas, puertas,
 * pilares) como salida estructurada y devuelve, junto a ellos, el disclaimer
 * legal obligatorio. Lo detectado se confirma DESPUÉS por el usuario antes de
 * avanzar, para no gastar créditos sobre un análisis erróneo.
 */
import type { ChatVisionAdapter, StructuralElements, MessagePart } from '@/lib/contracts';
import { INGESTA_DISCLAIMER } from '../legal/seal';

export interface IngestaResult {
  detected: StructuralElements;
  disclaimer: string;
}

const ELEMENTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['walls', 'doors', 'windows', 'pillars'],
  properties: {
    walls: { type: 'integer' },
    doors: { type: 'integer' },
    windows: { type: 'integer' },
    pillars: { type: 'integer' },
  },
};

/**
 * Ejecuta el análisis visual sobre la imagen de origen. `imageParts` ya viene
 * saneada por la capa de IA (bytes validados, sin EXIF); aquí solo se compone el
 * mensaje multimodal y se interpreta la respuesta.
 */
export async function runIngesta(
  chat: ChatVisionAdapter,
  imageParts: MessagePart[],
): Promise<IngestaResult> {
  const result = await chat.chat({
    model: '',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Detecta los elementos estructurales del espacio.' },
          ...imageParts,
        ],
      },
    ],
    responseSchema: ELEMENTS_SCHEMA,
  });

  return {
    detected: toElements(result.structured),
    disclaimer: INGESTA_DISCLAIMER,
  };
}

function toElements(v: unknown): StructuralElements {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  return {
    walls: int(o.walls),
    doors: int(o.doors),
    windows: int(o.windows),
    pillars: int(o.pillars),
  };
}

function int(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
}
