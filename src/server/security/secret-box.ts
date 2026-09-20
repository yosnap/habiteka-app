import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function key(): Buffer {
  const value = process.env.ADMIN_SECRETS_KEY;
  if (value) {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length !== 32) throw new Error('ADMIN_SECRETS_KEY debe ser base64 de 32 bytes');
    return decoded;
  }
  const authSecret = process.env.BETTER_AUTH_SECRET;
  const developmentSeed = process.env.NODE_ENV === 'production' ? undefined : process.env.DATABASE_URL;
  if (!authSecret && !developmentSeed) throw new Error('Configura ADMIN_SECRETS_KEY o BETTER_AUTH_SECRET');
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
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}

export function secretHint(value: string): string { return `••••${value.slice(-4)}`; }
