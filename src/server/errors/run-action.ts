import type { ActionErrorResult } from '@/lib/action-result';
import { UserFacingError } from './user-facing-error';

/**
 * Envuelve el cuerpo de una Server Action expuesta al cliente. Si lanza un
 * `UserFacingError`, lo convierte en un valor de retorno `{ actionError }` en
 * vez de dejarlo propagar (ver `UserFacingError` para el porqué). Cualquier
 * otro error se relanza: es un fallo inesperado y el 500 genérico redactado
 * por Next.js es el comportamiento correcto — no hay un mensaje seguro que dar.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<T | ActionErrorResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UserFacingError) return { actionError: err.message };
    throw err;
  }
}

/** Reemplazo de `throw new Error(mensaje)` en guardas de negocio: el mensaje llega al usuario. */
export function fail(message: string): never {
  throw new UserFacingError(message);
}
