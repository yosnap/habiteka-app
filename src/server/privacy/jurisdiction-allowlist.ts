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
let loadedFromEnv = false;

/** Carga la allowlist de la env una sola vez (idempotente). */
function ensureLoadedFromEnv(): void {
  if (loadedFromEnv) return;
  loadedFromEnv = true;
  loadAllowlist(process.env.AI_MODEL_JURISDICTION_ALLOWLIST);
}

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
  // Una carga explícita cuenta como inicialización: la auto-carga de la env no
  // debe pisarla después.
  loadedFromEnv = true;
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

/**
 * true si hay una allowlist configurada. Cuando NO la hay, el control de
 * jurisdicción está desactivado (el operador no lo ha configurado) y no debe
 * bloquear todas las llamadas; al configurar `AI_MODEL_JURISDICTION_ALLOWLIST`
 * pasa a aplicarse fail-closed.
 */
export function isAllowlistActive(): boolean {
  return allowlist.size > 0;
}

/**
 * Aplica el control de jurisdicción SOLO si hay allowlist configurada. Es el
 * punto que el routing de IA invoca: sin configuración no rompe el servicio;
 * con configuración, exige que el modelo esté permitido.
 */
export function enforceModelJurisdiction(model: string): void {
  ensureLoadedFromEnv();
  if (isAllowlistActive()) {
    assertModelAllowed(model);
  }
}

/** Solo para tests: vacía la allowlist y olvida la carga previa de la env. */
export function resetAllowlist(): void {
  allowlist = new Set();
  loadedFromEnv = false;
}
