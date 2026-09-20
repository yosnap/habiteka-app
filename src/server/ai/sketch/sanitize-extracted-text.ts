/**
 * Saneado del TEXTO que el modelo de visión lee de una imagen (nombres de
 * estancia, rótulos de cotas, etiquetas de mobiliario). Ese texto lo escribió
 * quien dibujó el plano: puede contener instrucciones ("ignora lo anterior…")
 * que acabarían en etiquetas del editor y en prompts de render/vídeo. Aquí se
 * reduce a un rótulo corto con caracteres de un plano y nada más.
 */

export const MAX_EXTRACTED_TEXT_LENGTH = 40;

// Letras (con tildes/ñ), dígitos, espacio y la puntuación propia de un rótulo
// de plano: "Dorm. principal", "3,50 x 4,00 m", "B°1", "Salón-comedor", "2º".
const ALLOWED = /[^\p{L}\p{N} .,'’\-/×xºª°()]/gu;

/** Rótulo corto y seguro; cadena vacía si no queda nada útil. */
export function sanitizeExtractedText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .replace(ALLOWED, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_EXTRACTED_TEXT_LENGTH)
    .trim();
}
