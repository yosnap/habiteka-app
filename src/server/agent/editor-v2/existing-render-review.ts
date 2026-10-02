import type { ImageResult } from '@/lib/contracts';

export const EXISTING_RENDER_REVIEW_VERSION = 'habiteka-existing-image-review-v1';

/** Solo cambia el origen de los bytes: la misma auditoría y las guardas siguen siendo obligatorias. */
export async function generateOrReviewRender(
  existingImageDataUrl: string | undefined,
  generate: () => Promise<ImageResult>,
): Promise<ImageResult> {
  if (existingImageDataUrl === undefined) return generate();
  if (existingImageDataUrl.length > 14_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(existingImageDataUrl))
    throw new Error('La imagen existente debe ser un PNG dentro del tamaño permitido.');
  return { assetUrl: existingImageDataUrl, cost: { amountUsd: 0, unit: 'existing-image' },
    generation: { provider: 'import', model: 'existing-image-review', fallbackIndex: 0 } };
}
