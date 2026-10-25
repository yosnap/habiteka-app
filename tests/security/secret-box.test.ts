import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { openSecret, sealSecret, secretHint } from '@/server/security/secret-box';

const OWN_KEY = Buffer.alloc(32, 7).toString('base64');
const SAMPLE = 'clave-de-ejemplo-123456';
afterEach(() => vi.unstubAllEnvs());

describe('cifrado de las claves de IA', () => {
  it('guarda solo texto cifrado, distinto en cada guardado, y una pista de 4 caracteres', () => {
    vi.stubEnv('ADMIN_SECRETS_KEY', OWN_KEY);
    const first = sealSecret(SAMPLE), second = sealSecret(SAMPLE);
    expect(first).not.toContain(SAMPLE);
    expect(first).not.toBe(second);
    expect(openSecret(first)).toBe(SAMPLE);
    expect(secretHint(SAMPLE)).toBe('••••3456');
  });

  it('en producción exige una clave de cifrado propia', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_SECRETS_KEY', '');
    vi.stubEnv('BETTER_AUTH_SECRET', 'secreto-de-sesion');
    expect(() => sealSecret(SAMPLE)).toThrow(/ADMIN_SECRETS_KEY/);
  });

  it('con la clave propia sigue leyendo lo cifrado con la clave derivada anterior', () => {
    // Antes: sin clave propia, se derivaba del secreto de sesión.
    vi.stubEnv('BETTER_AUTH_SECRET', 'secreto-de-sesion');
    vi.stubEnv('ADMIN_SECRETS_KEY', '');
    const legacy = sealSecret(SAMPLE);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_SECRETS_KEY', OWN_KEY);
    expect(openSecret(legacy)).toBe(SAMPLE);
    expect(openSecret(sealSecret(SAMPLE))).toBe(SAMPLE);
  });

  it('una credencial manipulada no se descifra', () => {
    vi.stubEnv('ADMIN_SECRETS_KEY', OWN_KEY);
    const [iv, tag, data] = sealSecret(SAMPLE).split('.');
    expect(() => openSecret([iv, tag, Buffer.from('otro contenido').toString('base64')].join('.'))).toThrow();
    expect(data).toBeTruthy();
  });
});
