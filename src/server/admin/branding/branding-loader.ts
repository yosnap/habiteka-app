/**
 * Lectura cacheada de la configuración de marca, consumida por el layout raíz.
 *
 * La marca (nombre, logos, colores) es editable desde el back-office sin redeploy.
 * Se cachea en memoria para no consultar la base en cada render y se invalida al
 * guardar, de modo que el cambio se refleja en la siguiente carga.
 */
import { prisma } from '@/server/db/prisma';

export interface Branding {
  brandName: string;
  logoAssetId: string | null;
  logoMobileAssetId: string | null;
  colors: Record<string, string>;
}

const DEFAULT_BRANDING: Branding = {
  brandName: 'Habiteka',
  logoAssetId: null,
  logoMobileAssetId: null,
  colors: {},
};

let cache: Branding | null = null;

export function invalidateBranding(): void {
  cache = null;
}

export async function getBranding(): Promise<Branding> {
  if (cache) return cache;
  const row = await prisma.brandSettings.findFirst();
  cache = row
    ? {
        brandName: row.brandName,
        logoAssetId: row.logoAssetId,
        logoMobileAssetId: row.logoMobileAssetId,
        colors: (row.colors as Record<string, string>) ?? {},
      }
    : DEFAULT_BRANDING;
  return cache;
}
