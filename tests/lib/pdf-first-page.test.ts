import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_ACTION_BASE64_CHARS } from '@/components/chat/prepare-upload';
import { rasterizePdfFirstPage } from '@/components/plano-studio/pdf-to-png';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

afterEach(() => vi.unstubAllGlobals());

describe('primera página de PDF al contrato de importación de imagen', () => {
  it('rasteriza un plano real y entrega una imagen válida dentro del límite de la acción', async () => {
    vi.stubGlobal('document', { createElement: () => createCanvas(1, 1) });
    vi.stubGlobal('DOMMatrix', DOMMatrix);
    vi.stubGlobal('ImageData', ImageData);
    vi.stubGlobal('Path2D', Path2D);
    const bytes = readFileSync(join(process.cwd(), 'tests/fixtures/plans/plano-arquitecto-1.pdf'));
    const file = new File([new Uint8Array(bytes)], 'plano-arquitecto-1.pdf', { type: 'application/pdf' });
    const resolve = createRequire(import.meta.url).resolve;
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')).toString();

    const image = await rasterizePdfFirstPage(file, pdfjs.getDocument);
    const metadata = await sharp(Buffer.from(image.base64, 'base64')).metadata();

    expect(['image/png', 'image/jpeg']).toContain(image.mimeType);
    expect(image.base64.length).toBeLessThanOrEqual(MAX_ACTION_BASE64_CHARS);
    expect(metadata.width).toBe(image.width);
    expect(metadata.height).toBe(image.height);
    expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(2400);
    expect(Math.min(image.width, image.height)).toBeGreaterThan(1000);
  });
});
