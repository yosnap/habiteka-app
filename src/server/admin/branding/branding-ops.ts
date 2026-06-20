/**
 * Edición de la marca desde el back-office. Valida los colores (hex) para no
 * inyectar valores corruptos en lo que la app renderiza, guarda el singleton de
 * marca, invalida su caché y registra la acción.
 */
import { prisma } from '@/server/db/prisma';
import { writeAudit } from '../audit';
import { invalidateBranding } from './branding-loader';
import { configError } from '../config/config-errors';

export interface BrandingInput {
  brandName: string;
  logoAssetId?: string | null;
  logoMobileAssetId?: string | null;
  colors?: Record<string, string>;
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function updateBranding(actorId: string, input: BrandingInput): Promise<void> {
  if (!input.brandName.trim()) {
    throw configError('El nombre de marca no puede estar vacío');
  }
  for (const [name, value] of Object.entries(input.colors ?? {})) {
    if (!HEX.test(value)) {
      throw configError(`Color inválido para "${name}": ${value}`);
    }
  }

  // La marca es un singleton: si existe se actualiza, si no se crea.
  const existing = await prisma.brandSettings.findFirst({ select: { id: true } });
  const data = {
    brandName: input.brandName,
    logoAssetId: input.logoAssetId ?? null,
    logoMobileAssetId: input.logoMobileAssetId ?? null,
    colors: (input.colors ?? {}) as object,
  };
  if (existing) {
    await prisma.brandSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.brandSettings.create({ data });
  }

  invalidateBranding();
  await writeAudit({
    actorId,
    action: 'update_branding',
    targetType: 'brand_settings',
    targetId: 'singleton',
  });
}
