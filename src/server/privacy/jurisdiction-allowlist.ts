/**
 * Allowlist de modelos de IA por jurisdicción (RGPD art. 44+).
 *
 * El routing por defecto de OpenRouter es NO determinista: elige proveedor por
 * request y puede enrutar a jurisdicciones sin garantías de transferencia. Para
 * una transferencia internacional lícita, solo se permiten modelos cuya cadena
 * de tratamiento tiene SCCs / despliegue UE / zero-retention.
 *
 * El routing de F3 consulta `assertModelAllowed` antes de seleccionar un modelo.
 * La lista vive en configuración (env) para poder ampliarla sin redeploy de
 * lógica; aquí solo está el contrato y el parseo.
 */

/** Modelos permitidos para tratamiento de datos personales. */
let allowlist: Set<string> = new Set();

/**
 * Carga la allowlist desde una lista separada por comas (p. ej. la env
 * `AI_MODEL_JURISDICTION_ALLOWLIST`). Vacía o sin valor → allowlist vacía.
 */
export function loadAllowlist(raw: string | undefined): void {
  allowlist = new Set(
    (raw ?? '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
  );
}

/** true si el modelo está en la allowlist de jurisdicción. */
export function isModelAllowed(model: string): boolean {
  return allowlist.has(model);
}

export class JurisdictionError extends Error {
  constructor(public readonly model: string) {
    super(`Modelo fuera de la allowlist de jurisdicción (RGPD art. 44): ${model}`);
    this.name = 'JurisdictionError';
  }
}

/** Lanza si el modelo no está permitido. Pensado para el routing de F3. */
export function assertModelAllowed(model: string): void {
  if (!isModelAllowed(model)) {
    throw new JurisdictionError(model);
  }
}

/** Solo para tests: vacía la allowlist. */
export function resetAllowlist(): void {
  allowlist = new Set();
}
