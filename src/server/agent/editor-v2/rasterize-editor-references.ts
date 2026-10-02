import sharp from 'sharp';
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { rasterizeEditorDocument } from './rasterize-editor-document';
import { rasterizeEditorStructure } from './rasterize-editor-structure';

export interface EditorDesignReferences {
  primary: { base64: string; mimeType: 'image/png' };
  all: Array<{ base64: string; mimeType: 'image/png' }>;
  aspectRatio: string;
}

/**
 * Prepara cuatro referencias globales o una sola planta recortada a la zona.
 * La geometría siempre procede del documento V2, nunca de una captura UI.
 */
export async function rasterizeEditorDesignReferences(
  document: EditorDocument,
  zone?: readonly Point[],
): Promise<EditorDesignReferences> {
  if (zone?.length) {
    const plan = await rasterizeEditorDocument(document, zone);
    const reference = { base64: plan.base64, mimeType: 'image/png' as const };
    return { primary: reference, all: [reference], aspectRatio: plan.aspectRatio };
  }
  const [activePlan, front, reverse, levelSheet] = await Promise.all([
    rasterizeEditorDocument(document),
    rasterizeEditorStructure(document, 'front'),
    rasterizeEditorStructure(document, 'reverse'),
    rasterizeAllLevels(document),
  ]);
  const toReference = (base64: string) => ({ base64, mimeType: 'image/png' as const });
  return {
    primary: toReference(activePlan.base64),
    all: [activePlan, front, reverse, levelSheet].map((image) => toReference(image.base64)),
    aspectRatio: activePlan.aspectRatio,
  };
}

async function rasterizeAllLevels(document: EditorDocument) {
  const plans = await Promise.all(
    buildingDocuments(document).map(({ document: level }) => rasterizeEditorDocument(level)),
  );
  if (plans.length === 1) return plans[0]!;

  const tiles = await Promise.all(plans.map((plan) => sharp(Buffer.from(plan.base64, 'base64')).png().toBuffer()));
  const metadata = await Promise.all(tiles.map((tile) => sharp(tile).metadata()));
  const width = Math.max(...metadata.map((item) => item.width ?? 1));
  const height = Math.max(...metadata.map((item) => item.height ?? 1));
  const sheet = sharp({
    create: { width: width * tiles.length, height, channels: 4, background: '#fbfaf7' },
  }).composite(tiles.map((tile, index) => ({ input: tile, left: index * width, top: 0 })));
  const png = await sheet.png().toBuffer();
  return { base64: png.toString('base64'), aspectRatio: `${tiles.length}:1` };
}
