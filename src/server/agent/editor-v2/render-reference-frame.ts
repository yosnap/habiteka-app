import sharp from 'sharp';

export type RenderReferenceImage = { base64: string; mimeType: 'image/png'; width: number; height: number };

const OUTPUT_RATIOS = [
  ['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['3:2', 3 / 2],
  ['2:3', 2 / 3], ['16:9', 16 / 9], ['9:16', 9 / 16], ['21:9', 21 / 9],
] as const;

/** Fija el formato desde la cámara, nunca desde las referencias auxiliares. No recorta ni estira píxeles. */
export async function fitRenderReferenceAspect(image: RenderReferenceImage, mask?: RenderReferenceImage) {
  if (mask && (image.width !== mask.width || image.height !== mask.height))
    throw new Error('La máscara no coincide con la captura. Vuelve a preparar esta vista.');
  const sourceRatio = image.width / image.height;
  const [aspectRatio, ratio] = OUTPUT_RATIOS.reduce((best, item) =>
    Math.abs(Math.log(item[1] / sourceRatio)) < Math.abs(Math.log(best[1] / sourceRatio)) ? item : best);
  const width = sourceRatio < ratio ? Math.ceil(image.height * ratio) : image.width;
  const height = sourceRatio > ratio ? Math.ceil(image.width / ratio) : image.height;
  if (width === image.width && height === image.height) return { image, mask, aspectRatio };
  const left = Math.floor((width - image.width) / 2), top = Math.floor((height - image.height) / 2);
  const padding = { left, right: width - image.width - left, top, bottom: height - image.height - top };
  const extend = async (source: RenderReferenceImage, background: string): Promise<RenderReferenceImage> => ({
    base64: (await sharp(Buffer.from(source.base64, 'base64'))
      .extend({ ...padding, background }).png().toBuffer()).toString('base64'),
    mimeType: 'image/png', width, height,
  });
  // La captura general conserva su fondo; una zona aislada y su máscara ya tienen fondos fijos.
  const corner = await sharp(Buffer.from(image.base64, 'base64'))
    .flatten({ background: '#ffffff' }).toColourspace('srgb').removeAlpha()
    .extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  const background = mask ? '#d8d8d8' : `rgb(${corner[0]},${corner[1]},${corner[2]})`;
  return { image: await extend(image, background), mask: mask ? await extend(mask, '#000000') : undefined, aspectRatio };
}
