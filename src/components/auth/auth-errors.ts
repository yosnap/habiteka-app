/**
 * Traduce los códigos de error de Better Auth a mensajes en español para el
 * usuario. Cualquier código no contemplado cae a un mensaje genérico (sin filtrar
 * detalles internos del servidor).
 */
const MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Ese correo ya está registrado. Prueba a acceder.',
  USER_ALREADY_EXISTS: 'Ese correo ya está registrado. Prueba a acceder.',
  INVALID_EMAIL_OR_PASSWORD: 'Correo o contraseña incorrectos.',
  EMAIL_NOT_VERIFIED: 'Verifica tu correo antes de acceder; te enviamos un enlace al registrarte.',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 8 caracteres.',
};

export function translateAuthError(code?: string, fallback?: string): string {
  if (code && MESSAGES[code]) return MESSAGES[code];
  return fallback || 'No se pudo completar la operación. Inténtalo de nuevo.';
}

/** true si el error indica que falta verificar el correo (para mostrar el aviso). */
export function isEmailNotVerified(code?: string): boolean {
  return code === 'EMAIL_NOT_VERIFIED';
}
