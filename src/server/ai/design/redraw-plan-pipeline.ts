/**
 * Redibujado del plano IMAGEN→IMAGEN: la foto/escaneo original viaja como
 * referencia al modelo de imagen, que lo vuelve a dibujar como plano de
 * arquitectura profesional. No hay extracción de coordenadas de por medio —
 * los modelos de imagen preservan la disposición visual mucho mejor de lo que
 * un modelo de visión la reconstruye en números (verificado con planos
 * reales: la vía vectorial desplazaba habitaciones; el redibujado directo
 * calca el original).
 *
 * El resultado es una IMAGEN (el entregable visual); la vía vectorial sigue
 * existiendo aparte para obtener geometría editable.
 */
import type { ImageAdapter, ImageResult } from '@/lib/contracts';

/** Prompt del redibujado. Puro, testeable. */
export function redrawPlanPrompt(): string {
  return [
    'Redibuja el plano de planta de esta imagen como un PLANO DE ARQUITECTURA 2D profesional',
    'y limpio, en vista cenital estricta. Mantén EXACTAMENTE la misma distribución: mismas',
    'habitaciones, mismos muros en la misma posición y proporción, mismas puertas y ventanas.',
    '',
    'Estilo: fondo blanco liso, muros macizos en negro (poché), puertas como hueco con arco de',
    'barrido, ventanas como triple línea fina, etiquetas de cada estancia en español con la misma',
    'tipografía sans-serif limpia (usa los nombres del original si están rotulados).',
    '',
    'SOLO ESTRUCTURA: dibuja únicamente muros, puertas, ventanas y los rótulos de las',
    'estancias. NO dibujes mobiliario, sanitarios ni electrodomésticos AUNQUE el original los',
    'tenga (fregaderos, cocinas, bañeras, camas…): el plano resultante debe ser puramente',
    'estructural.',
    '',
    'PROHIBIDO: inventar habitaciones, muebles o elementos que no estén en el original; añadir',
    'cotas o medidas que no estén escritas en el original (si las hay, respétalas); cuadrículas,',
    'cajetines, logotipos, marcas de agua o texto decorativo.',
    '',
    'GEOMETRÍA: los muros y fachadas RECTOS del original deben mantenerse perfectamente rectos',
    'y continuos — no introduzcas quiebros, escalones ni retranqueos que el original no tenga,',
    'y conserva exactamente los que sí tenga. Cuenta los muros del original y dibuja EXACTAMENTE',
    'esos: ante la duda de si algo es un muro, NO lo dibujes — es mejor que falte un detalle a',
    'inventar un tabique.',
  ].join('\n');
}

/** Redibuja el plano original (base64) como plano técnico profesional. */
export async function redrawPlan(
  deps: { image: ImageAdapter },
  source: { base64: string; mimeType?: string; aspectRatio?: string },
): Promise<ImageResult> {
  return deps.image.generate({
    prompt: redrawPlanPrompt(),
    referenceImage: { base64: source.base64, mimeType: source.mimeType ?? 'image/png' },
    ...(source.aspectRatio ? { aspectRatio: source.aspectRatio } : {}),
  });
}
