/**
 * Contrato de error esperado entre una Server Action envuelta con `runAction`
 * (servidor) y su llamada en el cliente (`callAction`).
 *
 * Next.js redacta el mensaje de cualquier error que se LANCE atravesando el
 * límite de una Server Action en producción (queda un mensaje genérico y un
 * dígito de correlación en los logs): es el motivo de que errores de negocio
 * con mensaje pensado para el usuario —Términos sin aceptar, consentimiento
 * pendiente, proveedor de IA caído, saldo insuficiente...— llegaran como un
 * 500 sin explicación. Por eso esos errores viajan como DATO de retorno en vez
 * de como excepción; este módulo es isomorfo (sin `server-only` ni `use
 * client`) porque lo importan tanto acciones de servidor como componentes
 * cliente.
 */
export interface ActionErrorResult {
  actionError: string;
  code?: string;
}

export function isActionError(value: unknown): value is ActionErrorResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'actionError' in value &&
    typeof (value as { actionError: unknown }).actionError === 'string'
  );
}

/**
 * Cliente: espera el resultado de una Server Action envuelta con `runAction` y,
 * si el servidor devolvió un error esperado, lo relanza como `Error` normal —
 * así el `catch` que cada pantalla ya tenía sigue funcionando sin cambios.
 */
export async function callAction<T>(promise: Promise<T | ActionErrorResult>): Promise<T> {
  const result = await promise;
  if (isActionError(result)) throw Object.assign(new Error(result.actionError), { code: result.code });
  return result;
}
