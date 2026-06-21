import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getModelConfig, invalidate } from '@/server/ai/model-config-loader';
import { resolveRoute, MAX_FALLBACKS } from '@/server/ai/model-routing';
import { MODEL_DEFAULTS } from '@/server/ai/model-defaults';
import { prisma } from '@/server/db/prisma';
import type { ModelAction } from '@/generated/prisma/enums';

async function clearModelConfig() {
  await prisma.modelConfig.deleteMany();
  invalidate();
}

// Restaura la config sembrada al terminar: estos tests comparten la BD con el
// entorno de desarrollo, así que no deben dejar valores de prueba (p. ej.
// `primaryModel: 'p'`) que envenenarían la app local tras correr la suite.
afterAll(async () => {
  await prisma.modelConfig.deleteMany();
  for (const [action, route] of Object.entries(MODEL_DEFAULTS)) {
    await prisma.modelConfig.create({
      data: {
        action: action as ModelAction,
        primaryModel: route.primaryModel,
        fallbacks: route.fallbacks,
        provider: route.provider,
        baseURL: route.baseURL,
      },
    });
  }
  invalidate();
});

describe('model-config-loader (Postgres real)', () => {
  beforeEach(clearModelConfig);

  it('tabla vacía devuelve los defaults de código (la IA nunca queda sin modelo)', async () => {
    const route = await getModelConfig('chat');
    expect(route.primaryModel).toBe(MODEL_DEFAULTS.chat.primaryModel);
  });

  it('lee el modelo guardado en BD para la acción', async () => {
    await prisma.modelConfig.create({
      data: { action: 'chat', primaryModel: 'custom/model', fallbacks: ['x/y'] },
    });
    invalidate();
    const route = await getModelConfig('chat');
    expect(route.primaryModel).toBe('custom/model');
  });

  it('usa caché: cambiar la BD sin invalidar no se refleja; tras invalidate sí', async () => {
    await prisma.modelConfig.create({
      data: { action: 'vision', primaryModel: 'v1', fallbacks: [] },
    });
    invalidate();
    expect((await getModelConfig('vision')).primaryModel).toBe('v1');

    await prisma.modelConfig.update({ where: { action: 'vision' }, data: { primaryModel: 'v2' } });
    // Sin invalidar: sigue el valor cacheado.
    expect((await getModelConfig('vision')).primaryModel).toBe('v1');

    invalidate();
    expect((await getModelConfig('vision')).primaryModel).toBe('v2');
  });
});

describe('model-routing (allowlist + límite de respaldos)', () => {
  beforeEach(clearModelConfig);

  it('recorta los respaldos al máximo permitido', async () => {
    await prisma.modelConfig.create({
      data: { action: 'chat', primaryModel: 'p', fallbacks: ['a', 'b', 'c', 'd', 'e'] },
    });
    invalidate();
    const route = await resolveRoute('chat');
    expect(route.fallbacks.length).toBeLessThanOrEqual(MAX_FALLBACKS);
  });

  it('un provider fuera de la allowlist se ignora (baseURL null)', async () => {
    await prisma.modelConfig.create({
      data: {
        action: 'chat',
        primaryModel: 'p',
        fallbacks: [],
        provider: 'gateway-malicioso',
        baseURL: 'https://malicioso.example',
      },
    });
    invalidate();
    const route = await resolveRoute('chat');
    expect(route.baseURL).toBeNull();
  });
});
