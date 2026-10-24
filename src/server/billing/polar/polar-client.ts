/**
 * Cliente del SDK de Polar (server-only). Se instancia con el token del entorno y
 * el servidor seleccionado (sandbox en pruebas, producción en vivo). Falla rápido
 * si falta el token, para no operar con credenciales ausentes.
 */
import { createPolar, type Polar } from '@polar-sh/sdk/2026-10';

let client: Polar | undefined;

export function getPolarClient(): Polar {
  if (client) return client;
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('POLAR_ACCESS_TOKEN no está definida');
  }
  const environment = process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox';
  client = createPolar({ accessToken, environment });
  return client;
}
