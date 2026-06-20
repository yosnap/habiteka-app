import { describe, it, expect } from 'vitest';
import { createAddonRegistry, type AddonDefinition } from '@/lib/addons/registry';

const votacion: AddonDefinition = {
  id: 'votacion',
  name: 'Votación comunitaria',
  sdkVersion: '1.0.0',
  slots: ['canvas.toolbar', 'agent.postEntrega'],
};

describe('createAddonRegistry', () => {
  it('registra y recupera una definición por id', () => {
    const registry = createAddonRegistry();
    registry.register(votacion);
    expect(registry.get('votacion')).toEqual(votacion);
    expect(registry.list()).toHaveLength(1);
  });

  it('devuelve undefined para un id no registrado', () => {
    const registry = createAddonRegistry();
    expect(registry.get('inexistente')).toBeUndefined();
  });

  it('rechaza un sdkVersion inválido', () => {
    const registry = createAddonRegistry();
    expect(() => registry.register({ ...votacion, sdkVersion: 'no-semver' })).toThrow(
      /sdkVersion inválido/,
    );
  });

  it('rechaza un add-on duplicado', () => {
    const registry = createAddonRegistry();
    registry.register(votacion);
    expect(() => registry.register(votacion)).toThrow(/duplicado/);
  });
});
