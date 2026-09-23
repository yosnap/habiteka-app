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
import { detectWallsFromImage } from '@/server/plan/detect-walls-raster';
import {
  classifyImageKind,
  IMAGE_KINDS,
  rasterLooksLikePlan,
  toImageKind,
  type ImageKindValue,
} from './image-kind';

export interface IngestaResult {
  detected: StructuralElements;
  /** Plano en planta o foto: decide si el render por imagen tiene sentido. */
  imageKind: ImageKindValue;
  disclaimer: string;
}

const ELEMENTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['walls', 'doors', 'windows', 'pillars', 'imageKind'],
  properties: {
    walls: { type: 'integer' },
    doors: { type: 'integer' },
    windows: { type: 'integer' },
    pillars: { type: 'integer' },
    imageKind: { type: 'string', enum: [...IMAGE_KINDS] },
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
          {
            type: 'text',
            text:
              'Analiza esta imagen de un espacio o boceto de vivienda y cuenta sus elementos ' +
              'estructurales. Cuenta TODAS las paredes visibles que delimitan el espacio ' +
              '(incluidas las exteriores del contorno), las puertas, las ventanas (cualquier ' +
              'forma: cuadradas, redondas, etc.) y los pilares. Si es el contorno de una casa, ' +
              'las cuatro fachadas cuentan como paredes. Indica además en `imageKind` si la ' +
              'imagen es un PLANO en planta / dibujo técnico visto desde arriba ' +
              '("floor_plan"), una FOTOGRAFÍA de un espacio real o un render en perspectiva ' +
              '("room_photo"), u otra cosa ("other"). Devuelve solo los números y ese campo.',
          },
          ...imageParts,
        ],
      },
    ],
    responseSchema: ELEMENTS_SCHEMA,
  });

  const structured = (
    typeof result.structured === 'object' && result.structured !== null ? result.structured : {}
  ) as Record<string, unknown>;

  return {
    detected: toElements(structured),
    imageKind: classifyImageKind(toImageKind(structured.imageKind), await rasterHint(imageParts)),
    disclaimer: INGESTA_DISCLAIMER,
  };
}

/**
 * Segunda opinión local y gratuita: el barrido de bandas oscuras que ya usa la
 * importación de planos. Solo desempata; si falla (imagen remota, formato que
 * sharp no abre) se prescinde de ella en vez de tumbar la ingesta.
 */
async function rasterHint(imageParts: MessagePart[]): Promise<{ looksLikePlan: boolean } | null> {
  const image = imageParts.find(
    (part): part is Extract<MessagePart, { type: 'image_url' }> =>
      part.type === 'image_url' && Boolean(part.base64),
  );
  if (!image?.base64) return null;
  try {
    const { walls } = await detectWallsFromImage(Buffer.from(image.base64, 'base64'));
    return { looksLikePlan: rasterLooksLikePlan(walls) };
  } catch {
    return null;
  }
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
