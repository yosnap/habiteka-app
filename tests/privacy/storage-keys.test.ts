import { describe, it, expect } from 'vitest';
import { toStorageKey, storageKeyFromDeliverablePayload } from '@/server/privacy/storage-keys';

describe('toStorageKey', () => {
  it('extrae la clave del pathname de una URL', () => {
    expect(toStorageKey('https://cdn.example.com/renders/abc.png')).toBe('renders/abc.png');
  });

  it('devuelve una clave tal cual (sin barra inicial)', () => {
    expect(toStorageKey('/renders/abc.png')).toBe('renders/abc.png');
    expect(toStorageKey('renders/abc.png')).toBe('renders/abc.png');
  });

  it('null/vacío → null', () => {
    expect(toStorageKey(null)).toBeNull();
    expect(toStorageKey(undefined)).toBeNull();
    expect(toStorageKey('   ')).toBeNull();
  });
});

describe('storageKeyFromDeliverablePayload', () => {
  it('extrae la clave de un payload de render3d', () => {
    const payload = { type: 'render3d', assetUrl: 'https://cdn.example.com/r/1.png' };
    expect(storageKeyFromDeliverablePayload(payload)).toBe('r/1.png');
  });

  it('prefiere assetKey (clave exacta) a derivarla de la URL', () => {
    // En path-style (MinIO) la URL lleva el bucket en el pathname; assetKey es la
    // clave real del objeto, así que debe ganar.
    const payload = {
      type: 'render3d',
      assetKey: 'renders/nano-banana/abc.png',
      assetUrl: 'http://localhost:9000/habiteka-dev/renders/nano-banana/abc.png?X-Amz=...',
    };
    expect(storageKeyFromDeliverablePayload(payload)).toBe('renders/nano-banana/abc.png');
  });

  it('ignora payloads que no son render (plano2d/memoria)', () => {
    expect(storageKeyFromDeliverablePayload({ type: 'memoria', markdown: '# x' })).toBeNull();
    expect(storageKeyFromDeliverablePayload({ type: 'plano2d', plano: {} })).toBeNull();
    expect(storageKeyFromDeliverablePayload(null)).toBeNull();
  });
});
