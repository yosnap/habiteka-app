import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * Clave de cifrado de las credenciales: `ADMIN_SECRETS_KEY`, propia y separada del secreto de sesión. En producción es
 * obligatoria. Fuera de producción, sin ella, se deriva una de desarrollo para no bloquear el entorno local.
 */
function key(): Buffer {
  const value = process.env.ADMIN_SECRETS_KEY;
  if (value) {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length !== 32) throw new Error('ADMIN_SECRETS_KEY debe ser base64 de 32 bytes');
    return decoded;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Configura ADMIN_SECRETS_KEY (base64 de 32 bytes) para cifrar las claves de IA');
  const legacy = legacyKey();
  if (!legacy) throw new Error('Configura ADMIN_SECRETS_KEY');
  return legacy;
}

/**
 * Clave derivada que se usaba antes de exigir `ADMIN_SECRETS_KEY`. Solo sirve para LEER credenciales guardadas con
 * ella: al guardarlas de nuevo se cifran con la clave propia.
 */
function legacyKey(): Buffer | null {
  const authSecret = process.env.BETTER_AUTH_SECRET;
  const developmentSeed = process.env.NODE_ENV === 'production' ? undefined : process.env.DATABASE_URL;
  if (!authSecret && !developmentSeed) return null;
  // Separación de dominio: la clave de cifrado nunca es el secreto de sesión en sí.
  return createHash('sha256').update(`habiteka:admin-secrets:v1:${authSecret ?? developmentSeed}`).digest();
}

export function sealSecret(value: string): string {
  const iv = randomBytes(IV_BYTES), cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

export function openSecret(value: string): string {
  const [iv, tag, encrypted] = value.split('.');
  if (!iv || !tag || !encrypted) throw new Error('Credencial cifrada inválida');
  const open = (secret: Buffer) => {
    const decipher = createDecipheriv(ALGORITHM, secret, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
  };
  const current = key();
  try { return open(current); }
  catch (error) {
    // Credencial guardada antes de la clave propia: se lee con la derivada anterior, si es otra.
    const legacy = legacyKey();
    if (!legacy || legacy.equals(current)) throw error;
    return open(legacy);
  }
}

export function secretHint(value: string): string { return `••••${value.slice(-4)}`; }
