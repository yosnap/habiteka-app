import sharp from 'sharp';
import type { MessagePart } from '@/lib/contracts';
import type { OrgContext } from '@/server/auth/org-context';
import type { Point } from '@/lib/editor-document/schema';
import { loadStudio } from '@/server/plan/studio-repo';
import { readStudioImage } from '@/server/plan/studio-image';
import { buildPlanImport } from '@/server/plan/build-plan-import';

/** Mueble que se leyó en el boceto al importarlo, ya en milímetros del plano. */
export interface SketchGuideItem { label: string; kind: string; centreMm: Point; sizeMm: { x: number; y: number } }
/**
 * El boceto con el que el cliente importó el plano: su distribución deseada. La imagen se alinea con el plano por su
 * esquina (0, 0) y `frameMm`, igual que el «original» del editor.
 */
export interface SketchGuide { image: MessagePart; frameMm: { width: number; height: number }; items: SketchGuideItem[] }

const GUIDE_WIDTH_PX = 1400;

/**
 * Boceto del plano principal con los muebles que la importación leyó en él (`raw.mobiliario`), aunque se importara sin
 * muebles. Sin importación, sin imagen o en una zona, no hay guía y Amueblar diseña por su cuenta.
 */
export async function loadSketchGuide(ctx: OrgContext, projectId: string, zoneId: string | null): Promise<SketchGuide | null> {
  if (zoneId) return null;
  try {
    const imported = (await loadStudio(ctx, projectId)).planImport;
    if (!imported?.image || !imported.raw?.mobiliario?.length) return null;
    const frame = buildPlanImport(imported.raw, {
      generalWidthMm: imported.generalWidthMm, roomOverrides: imported.roomOverrides, doorOverrides: imported.doorOverrides,
      wallOverrides: imported.wallOverrides, includeFurniture: false,
      normalize: imported.detected ? { wallsOverride: imported.detected.walls, imageHeightOverWidth: imported.detected.heightOverWidth } : {},
    }).sourceFrameMm;
    if (!frame) return null;
    const source = await readStudioImage(imported.image);
    const image = await sharp(Buffer.from(source.base64, 'base64')).resize({ width: GUIDE_WIDTH_PX, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const items = imported.raw.mobiliario.map(({ tipo, etiqueta, bbox }) => ({
      label: etiqueta?.trim() || tipo, kind: tipo,
      centreMm: { x: Math.round((bbox.minX + bbox.maxX) / 2 * frame.width), y: Math.round((bbox.minY + bbox.maxY) / 2 * frame.height) },
      sizeMm: { x: Math.round((bbox.maxX - bbox.minX) * frame.width), y: Math.round((bbox.maxY - bbox.minY) * frame.height) },
    }));
    return { image: { type: 'image_url', base64: image.toString('base64'), mimeType: 'image/jpeg' }, frameMm: { width: Math.round(frame.width), height: Math.round(frame.height) }, items };
  } catch {
    // Una importación antigua que ya no se puede recalcular no impide amueblar.
    return null;
  }
}
