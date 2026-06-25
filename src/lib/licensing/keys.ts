/**
 * Registro de claves de firma de licencia, indexado por `kid`.
 *
 * El servidor firma con la clave privada y verifica con la pública; tener varias
 * claves por `kid` permite rotar la clave de firma sin invalidar los tokens ya
 * emitidos con la anterior (no hay caída durante la rotación). Las claves son
 * server-only; en tests se inyectan claves efímeras para no depender de secretos.
 */
import type { CryptoKey } from 'jose';

export interface KeyPair {
  kid: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

const keysByKid = new Map<string, KeyPair>();
let activeKid: string | null = null;

/** Registra un par de claves y, si es el primero, lo marca como activo. */
export function registerKeyPair(pair: KeyPair, makeActive = false): void {
  keysByKid.set(pair.kid, pair);
  if (makeActive || activeKid === null) {
    activeKid = pair.kid;
  }
}

/** Clave activa para FIRMAR nuevos tokens. */
export function activeSigningKey(): KeyPair {
  if (!activeKid) throw new Error('No hay clave de firma de licencia configurada');
  return keysByKid.get(activeKid)!;
}

/** Clave PÚBLICA por `kid` para verificar (incluida la rotada). */
export function publicKeyFor(kid: string): CryptoKey | undefined {
  return keysByKid.get(kid)?.publicKey;
}

/** Limpia el registro (tests). */
export function resetKeys(): void {
  keysByKid.clear();
  activeKid = null;
}
