/**
 * Error de negocio cuyo mensaje es seguro para mostrar al usuario: falta de
 * consentimiento, Términos sin aceptar, proveedor de IA caído, saldo
 * insuficiente... Las Server Actions envueltas con `runAction` (ver
 * `./run-action.ts`) capturan estos errores y los devuelven como dato en vez
 * de dejarlos propagar, porque Next.js redacta el mensaje de cualquier throw
 * que cruce el límite de una Server Action en producción.
 *
 * Un error que NO extiende esta clase (un bug real, un fallo de red inesperado)
 * debe seguir lanzándose tal cual: el 500 genérico es el comportamiento
 * correcto para lo que no se puede explicar de forma segura al usuario.
 */
export class UserFacingError extends Error {}
