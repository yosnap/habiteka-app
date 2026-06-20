/**
 * Creación de productos de pago en Polar desde el back-office.
 *
 * El administrador define el paquete de créditos o el plan (nombre, precio,
 * intervalo) y aquí se crea en Polar vía su API. El id resultante se guarda en los
 * ajustes de sistema para que el checkout lo referencie, evitando configurarlo a
 * mano en el entorno. La acción queda auditada.
 */
import { getPolarClient } from '@/server/billing/polar/polar-client';
import { updateSystemSetting } from '../config/system-setting-ops';
import { writeAudit } from '../audit';
import { configError } from '../config/config-errors';

export type RecurringInterval = 'month' | 'year';

export interface CreateProductInput {
  name: string;
  description?: string;
  /** Importe en la unidad menor (céntimos): 1999 = 19,99. */
  priceAmount: number;
  /** Moneda solicitada; informativa: Polar usa la moneda por defecto de la org. */
  currency: string;
  /** Si se indica, el producto es una suscripción con ese intervalo; si no, pago único. */
  recurringInterval?: RecurringInterval;
  /** Clave de `SystemSetting` donde guardar el id del producto (para el checkout). */
  settingKey: string;
}

export interface CreatedProduct {
  productId: string;
}

/** Crea el producto en Polar, guarda su id en los ajustes y audita. */
export async function createPolarProduct(
  actorId: string,
  input: CreateProductInput,
): Promise<CreatedProduct> {
  if (!input.name.trim()) throw configError('El nombre del producto es obligatorio');
  if (!Number.isInteger(input.priceAmount) || input.priceAmount <= 0) {
    throw configError('El precio debe ser un entero positivo en la unidad menor (céntimos)');
  }

  // En el SDK actual el intervalo de recurrencia va a nivel de producto; el
  // precio es un importe fijo. `priceCurrency` se omite para usar la moneda por
  // defecto de la organización cuando no es una de las soportadas como enum.
  const product = await getPolarClient().products.create({
    name: input.name,
    description: input.description,
    recurringInterval: input.recurringInterval ?? null,
    prices: [{ amountType: 'fixed', priceAmount: input.priceAmount }],
  });

  // El checkout referencia el producto por este id; guardarlo evita tocar el .env.
  await updateSystemSetting(actorId, input.settingKey, product.id);

  await writeAudit({
    actorId,
    action: 'create_polar_product',
    targetType: 'polar_product',
    targetId: product.id,
    meta: { name: input.name, settingKey: input.settingKey },
  });

  return { productId: product.id };
}
