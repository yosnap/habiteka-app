/**
 * Control de cuota del media manager. Antes de aceptar un asset nuevo se comprueba
 * que no se supera el límite configurable de tamaño total o de número de assets,
 * para evitar que un abuso llene el bucket. El límite vive en los ajustes de
 * sistema, de modo que se ajusta sin redeploy.
 */
import { prisma } from '@/server/db/prisma';

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

const DEFAULT_MAX_TOTAL_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
const DEFAULT_MAX_ASSETS = 10_000;

async function readNumberSetting(key: string, fallback: number): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  const value = setting?.value;
  return typeof value === 'number' ? value : fallback;
}

/** Lanza `QuotaExceededError` si añadir `incomingBytes` superaría la cuota. */
export async function assertWithinQuota(incomingBytes: number): Promise<void> {
  const [maxBytes, maxAssets] = await Promise.all([
    readNumberSetting('media_max_total_bytes', DEFAULT_MAX_TOTAL_BYTES),
    readNumberSetting('media_max_assets', DEFAULT_MAX_ASSETS),
  ]);

  const [agg, count] = await Promise.all([
    prisma.mediaAsset.aggregate({ _sum: { size: true } }),
    prisma.mediaAsset.count(),
  ]);
  const usedBytes = agg._sum.size ?? 0;

  if (usedBytes + incomingBytes > maxBytes) {
    throw new QuotaExceededError('Se superaría la cuota de almacenamiento');
  }
  if (count + 1 > maxAssets) {
    throw new QuotaExceededError('Se superaría el número máximo de archivos');
  }
}
