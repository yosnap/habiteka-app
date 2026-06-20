import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb, makeUser } from '../helpers/db';
import { prisma } from '@/server/db/prisma';

// El cliente de Polar (servicio externo) se mockea: cero llamadas reales a la API.
const createMock = vi.fn();
vi.mock('@/server/billing/polar/polar-client', () => ({
  getPolarClient: () => ({ products: { create: createMock } }),
}));

import { createPolarProduct } from '@/server/admin/billing/product-ops';
import { ConfigValidationError } from '@/server/admin/config/config-errors';

const ADMIN = 'admin-1';

describe('createPolarProduct', () => {
  beforeEach(async () => {
    await resetDb();
    await makeUser();
    createMock.mockReset();
    createMock.mockResolvedValue({ id: 'prod_123' });
  });

  it('crea el producto en Polar y guarda su id en los ajustes', async () => {
    const result = await createPolarProduct(ADMIN, {
      name: 'Paquete de créditos',
      priceAmount: 1999,
      currency: 'usd',
      settingKey: 'polar_credits_product_id',
    });

    expect(result.productId).toBe('prod_123');
    expect(createMock).toHaveBeenCalledOnce();

    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'polar_credits_product_id' },
    });
    expect(setting?.value).toBe('prod_123');
  });

  it('pasa el intervalo de recurrencia para una suscripción', async () => {
    await createPolarProduct(ADMIN, {
      name: 'Plan Pro',
      priceAmount: 2999,
      currency: 'usd',
      recurringInterval: 'month',
      settingKey: 'polar_plan_product_id',
    });
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({ recurringInterval: 'month' });
  });

  it('rechaza un precio no positivo sin llamar a Polar', async () => {
    await expect(
      createPolarProduct(ADMIN, {
        name: 'X',
        priceAmount: 0,
        currency: 'usd',
        settingKey: 'k',
      }),
    ).rejects.toBeInstanceOf(ConfigValidationError);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('audita la creación del producto', async () => {
    await createPolarProduct(ADMIN, {
      name: 'Paquete',
      priceAmount: 999,
      currency: 'usd',
      settingKey: 'polar_credits_product_id',
    });
    const audit = await prisma.auditLog.findFirst({ where: { action: 'create_polar_product' } });
    expect(audit?.targetId).toBe('prod_123');
  });
});
