import { describe, it, expect } from 'vitest';
import {
  assertSafeImportUrl,
  isBlockedHost,
  UnsafeUrlError,
} from '@/server/admin/media/url-safety';

describe('url-safety (anti-SSRF)', () => {
  it('acepta una URL pública http/https', () => {
    expect(() => assertSafeImportUrl('https://cdn.ejemplo.com/img.png')).not.toThrow();
  });

  it('rechaza el endpoint de metadatos del cloud (169.254.169.254)', () => {
    expect(() => assertSafeImportUrl('http://169.254.169.254/latest/meta-data/')).toThrow(
      UnsafeUrlError,
    );
  });

  it('rechaza loopback y rangos privados', () => {
    expect(isBlockedHost('127.0.0.1')).toBe(true);
    expect(isBlockedHost('10.0.0.5')).toBe(true);
    expect(isBlockedHost('192.168.1.1')).toBe(true);
    expect(isBlockedHost('172.16.0.1')).toBe(true);
    expect(isBlockedHost('::1')).toBe(true);
  });

  it('rechaza nombres locales', () => {
    expect(isBlockedHost('localhost')).toBe(true);
    expect(isBlockedHost('servicio.internal')).toBe(true);
  });

  it('acepta una IP pública', () => {
    expect(isBlockedHost('93.184.216.34')).toBe(false);
  });

  it('rechaza esquemas que no son http/https (file, ftp, gopher)', () => {
    expect(() => assertSafeImportUrl('file:///etc/passwd')).toThrow(UnsafeUrlError);
    expect(() => assertSafeImportUrl('gopher://interno/')).toThrow(UnsafeUrlError);
  });
});
