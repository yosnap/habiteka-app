import sharp from 'sharp';

type Image = { base64: string; mimeType: 'image/png'; width: number; height: number };

/** Oculta todo lo que queda fuera de la zona y encuadra solo su parte visible. */
export async function isolateZoneReference(reference: Image, mask: Image): Promise<{ image: Image; mask: Image }> {
  if (reference.width !== mask.width || reference.height !== mask.height)
    throw new Error('La máscara no coincide con la captura. Vuelve a preparar esta vista.');
  const source = await sharp(Buffer.from(reference.base64, 'base64')).removeAlpha().raw().toBuffer();
  const area = await sharp(Buffer.from(mask.base64, 'base64')).removeAlpha().greyscale().raw().toBuffer();
  const width = reference.width, height = reference.height;
  const isolated = Buffer.alloc(width * height * 3, 216);
  const threshold = 128;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pixel = y * width + x;
    if (area[pixel]! < threshold) continue;
    const offset = pixel * 3;
    source.copy(isolated, offset, offset, offset + 3);
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top) throw new Error('La zona seleccionada no se ve desde esta cámara. Elige otro ángulo.');
  const padding = Math.max(8, Math.round(Math.max(right - left, bottom - top) * .06));
  const extract = { left: Math.max(0, left - padding), top: Math.max(0, top - padding),
    width: Math.min(width - Math.max(0, left - padding), right + padding + 1 - Math.max(0, left - padding)),
    height: Math.min(height - Math.max(0, top - padding), bottom + padding + 1 - Math.max(0, top - padding)) };
  const isolatedPng = await sharp(isolated, { raw: { width, height, channels: 3 } }).extract(extract).png().toBuffer();
  const maskPng = await sharp(area, { raw: { width, height, channels: 1 } }).extract(extract).png().toBuffer();
  const result = (bytes: Buffer): Image => ({ base64: bytes.toString('base64'), mimeType: 'image/png', width: extract.width, height: extract.height });
  return { image: result(isolatedPng), mask: result(maskPng) };
}

/** La imagen final conserva únicamente los píxeles de la zona autorizada. */
export async function isolateZoneResult(candidate: Image, mask: Image): Promise<Buffer> {
  const width = candidate.width, height = candidate.height;
  if (Math.abs(width / height - mask.width / mask.height) > .08)
    throw new Error('El diseño cambió la proporción de la zona seleccionada. Prueba con otro ángulo.');
  const source = await sharp(Buffer.from(candidate.base64, 'base64')).removeAlpha().raw().toBuffer();
  const area = await sharp(Buffer.from(mask.base64, 'base64')).resize(width, height, { fit: 'fill' }).removeAlpha().greyscale().raw().toBuffer();
  const isolated = Buffer.alloc(width * height * 3, 216);
  for (let pixel = 0; pixel < width * height; pixel++) {
    if (area[pixel]! < 128) continue;
    source.copy(isolated, pixel * 3, pixel * 3, pixel * 3 + 3);
  }
  return sharp(isolated, { raw: { width, height, channels: 3 } }).png().toBuffer();
}
