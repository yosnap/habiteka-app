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

/**
 * Modo del redibujado. `tecnico`: solo estructura (input de la extracción de
 * geometría). `decorado`: plano de presentación con el mobiliario, sanitarios
 * y elementos del original, coloreado, como el que entrega un estudio.
 */
export type RedrawMode = 'tecnico' | 'decorado';

/**
 * Reglas de FIDELIDAD comunes a cualquier salida imagen→imagen de un plano.
 * Cada punto responde a un fallo observado en renders reales: puertas leídas
 * como huecos anchos, ventanas inventadas, muros desproporcionados, medidas
 * escritas perdidas.
 */
export type FidelityTarget = 'plano' | 'render';

export function planFidelityRules(target: FidelityTarget = 'plano'): string {
  const puertas =
    target === 'render'
      ? [
          'PUERTAS: en el plano cada puerta aparece como un hueco con un ARCO DE BARRIDO. Ese arco es',
          'un SÍMBOLO de dibujo, no un objeto: en el render NO existe. Representa cada puerta con UNA',
          'SOLA hoja de madera, con la bisagra en el centro del arco (el vértice desde el que se',
          'traza) y abierta hacia la estancia a la que apunta el arco, entreabierta o cerrada.',
          'PROHIBIDO dibujar dos hojas, una hoja curva, o una hoja en el hueco y otra siguiendo el',
          'arco. La hoja mide lo que el hueco (unos 80–90 cm, nunca medio muro) y tiene la altura',
          'de una puerta normal, más baja que los muros.',
        ]
      : [
          'PUERTAS: cada puerta del original se dibuja con su HOJA y su ARCO DE BARRIDO exactamente',
          'como en el original: la bisagra está en el extremo del arco y la hoja abre hacia el mismo',
          'lado y hacia la misma estancia. La hoja mide lo que el hueco dibujado (una puerta normal',
          'ocupa unos 80–90 cm, nunca medio muro). No conviertas un arco de puerta en un hueco abierto.',
        ];
  const ventanas =
    target === 'render'
      ? [
          'VENTANAS: donde el plano dibuja una ventana (líneas paralelas finas o interrupción en la',
          'fachada), el render muestra un hueco acristalado con marco EN ESE MISMO MURO, del mismo',
          'ancho y en la misma posición; el resto del muro sigue macizo. PROHIBIDO añadir ventanas',
          'en muros que en el plano son ciegos y PROHIBIDO omitir las dibujadas.',
        ]
      : [
          'VENTANAS: SOLO donde el original las dibuja (líneas paralelas finas o interrupción en la',
          'fachada). PROHIBIDO añadir ventanas en muros que en el original son ciegos.',
        ];
  return [
    ...puertas,
    ...ventanas,
    'PROPORCIONES: respeta la escala y las medidas ESCRITAS en el original (p. ej. "1 cm = 1 m",',
    'superficies, cotas). Los muros exteriores son finos respecto a las estancias (unos 25–30 cm',
    'a escala) y los tabiques interiores más finos aún (10–12 cm); no engordes los muros ni',
    'encojas las habitaciones.',
  ].join('\n');
}

/** Prompt del redibujado. Puro, testeable. */
export function redrawPlanPrompt(mode: RedrawMode = 'tecnico'): string {
  const contenido =
    mode === 'decorado'
      ? [
          'CON MOBILIARIO: dibuja además TODOS los muebles, sanitarios, electrodomésticos, mesas,',
          'sillas y plantas que el original tiene, cada uno en su misma posición, orientación y',
          'tamaño relativo (cama, armario, sofá, mesa del comedor con sus sillas, bañera, inodoro,',
          'lavabo, lavadora, fregadero, fogones, mesa de la terraza…). Nada que no esté en el',
          'original. Acabado de presentación: suelos y muebles con color y textura suaves, sombras',
          'sutiles, estilo de plano comercial de inmobiliaria, con los rótulos de las estancias, la',
          'escala, la superficie y la flecha del norte tal y como aparecen en el original.',
        ]
      : [
          'SOLO ESTRUCTURA: dibuja únicamente muros, puertas, ventanas y los rótulos de las',
          'estancias. NO dibujes mobiliario, sanitarios ni electrodomésticos AUNQUE el original los',
          'tenga (fregaderos, cocinas, bañeras, camas…): el plano resultante debe ser puramente',
          'estructural.',
        ];
  return [
    'Redibuja el plano de planta de esta imagen como un PLANO DE ARQUITECTURA 2D profesional',
    'y limpio, en vista cenital estricta. Mantén EXACTAMENTE la misma distribución: mismas',
    'habitaciones, mismos muros en la misma posición y proporción, mismas puertas y ventanas.',
    '',
    'Estilo: fondo blanco liso, muros macizos en negro (poché), puertas como hueco con arco de',
    'barrido, ventanas como triple línea fina, etiquetas de cada estancia en español con la misma',
    'tipografía sans-serif limpia (usa los nombres del original si están rotulados).',
    '',
    ...contenido,
    '',
    planFidelityRules(),
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
  mode: RedrawMode = 'tecnico',
): Promise<ImageResult> {
  return deps.image.generate({
    prompt: redrawPlanPrompt(mode),
    referenceImage: { base64: source.base64, mimeType: source.mimeType ?? 'image/png' },
    ...(source.aspectRatio ? { aspectRatio: source.aspectRatio } : {}),
  });
}
