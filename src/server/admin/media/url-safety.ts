/**
 * Validación de destino para la importación de imágenes por URL (anti-SSRF).
 *
 * Importar por URL hace que el SERVIDOR descargue una dirección que aporta el
 * usuario; sin control, podría apuntarla a servicios internos o al endpoint de
 * metadatos del cloud. Aquí se restringe a http/https públicos y se bloquean los
 * rangos privados, loopback, link-local (incluido el 169.254.169.254 de
 * metadatos) y direcciones reservadas. La resolución de DNS y el control de
 * redirecciones los aplica quien hace el fetch sobre esta base.
 */
export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

/** Valida el esquema y el host de una URL de importación; lanza si es insegura. */
export function assertSafeImportUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('URL inválida');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Solo se admiten URLs http/https');
  }
  if (isBlockedHost(url.hostname)) {
    throw new UnsafeUrlError('El destino apunta a una dirección no permitida');
  }
  return url;
}

/** Verdadero si el host es una IP privada/reservada o un nombre local. */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return true;
  }
  if (isIpv4(host)) return isBlockedIpv4(host);
  // IPv6 loopback y link-local.
  if (
    host === '::1' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  ) {
    return true;
  }
  return false;
}

function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isBlockedIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true; // 10.0.0.0/8 privado
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 privado
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 privado
  if (a === 169 && b === 254) return true; // link-local + metadatos del cloud
  if (a >= 224) return true; // multicast / reservado
  return false;
}
