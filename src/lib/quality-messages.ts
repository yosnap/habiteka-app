/**
 * Frases de la puerta de calidad que la UI necesita reconocer.
 *
 * Cuando el servidor corta una generación por falta de confirmación expresa, el
 * cliente tiene que poder enseñar la casilla en vez de dejar al usuario en un
 * callejón sin salida. Para no acoplar la UI a un texto suelto, el mensaje se
 * escribe aquí una sola vez y `needsQualityConfirmation` lo reconoce.
 */

export const CONFIRM_HINT =
  'Marca «Entiendo las dudas y quiero generar igualmente» para continuar.';

export const CONFIRM_CHANGE_HINT =
  'Marca «Entiendo las dudas y quiero aplicar el cambio igualmente» para continuar.';

/** `true` si el mensaje de error del servidor pide una confirmación expresa. */
export function needsQualityConfirmation(message: unknown): boolean {
  if (typeof message !== 'string') return false;
  return message.includes(CONFIRM_HINT) || message.includes(CONFIRM_CHANGE_HINT);
}
