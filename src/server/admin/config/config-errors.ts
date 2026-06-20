/**
 * Error de validación de configuración del back-office. Señala una entrada que no
 * cumple las reglas (modelo fuera de la allowlist, valor negativo, etc.) para que
 * la UI muestre el motivo sin aplicar el cambio.
 */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export function configError(message: string): ConfigValidationError {
  return new ConfigValidationError(message);
}
