/**
 * Validación de URLs de afiliación (anti open-redirect).
 *
 * El endpoint de afiliación redirige a una URL del catálogo; si admitiera
 * cualquier destino, sería un open-redirect. Por eso solo se aceptan URLs de los
 * dominios de afiliación permitidos (Ikea / Amazon Associates). El tag de
 * afiliación lo fija el catálogo en el servidor, nunca el cliente.
 */
export class DisallowedAffiliateUrlError extends Error {
  constructor(url: string) {
    super(`URL de afiliación no permitida: ${url}`);
    this.name = 'DisallowedAffiliateUrlError';
  }
}

// Dominios (y subdominios) admitidos para enlaces de afiliación.
const ALLOWED_SUFFIXES = ['amazon.com', 'amazon.es', 'amzn.to', 'ikea.com'];

/** Verdadero si la URL pertenece a un dominio de afiliación permitido. */
export function isAllowedAffiliateUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** Devuelve la URL si es válida; lanza si el dominio no está permitido. */
export function assertAllowedAffiliateUrl(raw: string): string {
  if (!isAllowedAffiliateUrl(raw)) {
    throw new DisallowedAffiliateUrlError(raw);
  }
  return raw;
}
