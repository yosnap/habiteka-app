import sharp from 'sharp';

/** El resumen de una planta completa oculta herrajes, hojas y muebles deformados. */
export async function renderAuditDetails(image: { base64: string; mimeType: string }, preset: string) {
  if (preset !== 'top') return [];
  return renderIdentityDetails(image);
}

/** También admite interiores panorámicos: el detalle depende del lado largo. */
export async function renderIdentityDetails(image: { base64: string; mimeType: string }) {
  const buffer = Buffer.from(image.base64, 'base64');
  const { width = 0, height = 0 } = await sharp(buffer).metadata();
  if (Math.max(width, height) < 2000 || Math.min(width, height) < 600) return [];
  const tileWidth = Math.ceil(width * 0.56), tileHeight = Math.ceil(height * 0.56);
  return Promise.all([
    [0, 0], [width - tileWidth, 0], [0, height - tileHeight], [width - tileWidth, height - tileHeight],
  ].map(async ([left, top]) => ({ mimeType: 'image/jpeg', base64: (await sharp(buffer)
    .extract({ left: left!, top: top!, width: tileWidth, height: tileHeight })
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 94 }).toBuffer()).toString('base64') })));
}
