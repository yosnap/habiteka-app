import { AiError, aiError } from './errors';
import { providerLabel } from './custom-ai-providers';
import { AI_KEYS_SETTINGS_PATH } from '@/lib/ai-keys-settings';

/**
 * Si todas las rutas de «Modelos por uso» fallaron porque la organización no tiene la clave de su proveedor, un solo
 * mensaje claro: qué claves admitiría esta función y dónde añadirlas. Con cualquier otro fallo, `null`.
 */
export function missingKeysError(errors: readonly unknown[], routes: readonly { provider: string }[]): AiError | null {
  if (errors.length === 0 || !errors.every((error) => error instanceof AiError && error.kind === 'missing_key')) return null;
  const labels = [...new Set(routes.map((route) => providerLabel(route.provider)))];
  return aiError('missing_key', `Para usar esta función, tu organización necesita su propia clave de ${joinOr(labels)}. Añádela en Ajustes › Claves de IA (${AI_KEYS_SETTINGS_PATH}).`);
}

function joinOr(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} o ${items.at(-1)}`;
}
