/**
 * Techos por llamada (defensa en profundidad antes de tocar al proveedor).
 *
 * Independientemente del cap diario o global, una sola llamada no debe poder
 * disparar coste ilimitado: el chat acota su salida con `max_tokens` y la imagen
 * se limita en dimensiones y tamaño. Lo que excede se rechaza ANTES de gastar.
 */
import { aiError } from './errors';

/** Tope de tokens de salida por llamada de chat si quien llama no fija uno menor. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
/** Límite duro absoluto de tokens de salida; ninguna llamada lo supera. */
export const HARD_MAX_OUTPUT_TOKENS = 8192;

/** Lado máximo (px) de una imagen generada/inpaintada. */
export const MAX_IMAGE_DIMENSION = 2048;
/** Tamaño máximo (bytes) de una imagen de entrada. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Resuelve el `max_tokens` efectivo, acotado al límite duro. */
export function resolveMaxTokens(requested?: number): number {
  const value = requested ?? DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.min(Math.max(1, value), HARD_MAX_OUTPUT_TOKENS);
}

/** Lanza `AiError(call_limit)` si las dimensiones pedidas exceden el máximo. */
export function assertImageDimensions(width?: number, height?: number): void {
  if ((width && width > MAX_IMAGE_DIMENSION) || (height && height > MAX_IMAGE_DIMENSION)) {
    throw aiError('call_limit', `Dimensiones de imagen sobre el máximo (${MAX_IMAGE_DIMENSION}px)`);
  }
}

/** Lanza `AiError(call_limit)` si la imagen de entrada excede el tamaño máximo. */
export function assertImageBytes(bytes: number): void {
  if (bytes > MAX_IMAGE_BYTES) {
    throw aiError('call_limit', `Imagen de entrada sobre el máximo (${MAX_IMAGE_BYTES} bytes)`);
  }
}
