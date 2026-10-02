import { afterEach, describe, expect, it, vi } from 'vitest';
import DevelopmentLayout from '@/app/dev/layout';
import { notFound } from 'next/navigation';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_HTTP_ERROR_FALLBACK;404'); }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('barrera compartida de rutas de desarrollo', () => {
  it('permite las muestras únicamente en desarrollo', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(DevelopmentLayout({ children: 'muestra local' })).toBe('muestra local');
    expect(notFound).not.toHaveBeenCalled();
  });

  it.each(['production', 'test', undefined])('devuelve 404 en %s', (environment) => {
    vi.stubEnv('NODE_ENV', environment);
    expect(() => DevelopmentLayout({ children: 'muestra privada' }))
      .toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(notFound).toHaveBeenCalledOnce();
  });

  it.each(['true', 'false'])('el login de desarrollo %s no abre las muestras en producción', (flag) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_DEV_LOGIN', flag);
    expect(() => DevelopmentLayout({ children: 'muestra privada' }))
      .toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(notFound).toHaveBeenCalledOnce();
  });
});
