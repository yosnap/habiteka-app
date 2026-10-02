import 'server-only';
import sharp from 'sharp';

/** Por debajo, la zona no se ve en esta vista. */
export const ZONE_EMPTY_COVERAGE = 0.005;

/** Fracción de la imagen que ocupa la zona permitida (0–1). */
export async function zoneMaskCoverage(mask: Buffer): Promise<number> {
  const data = await sharp(mask).greyscale().extractChannel(0).raw().toBuffer();
  let sum = 0;
  for (const value of data) sum += value;
  return data.length ? sum / (data.length * 255) : 0;
}
