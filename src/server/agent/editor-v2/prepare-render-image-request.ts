import type { Estilo, ImageGenRequest } from '@/lib/contracts';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { fitRenderReferenceAspect, type RenderReferenceImage } from './render-reference-frame';
import { includeSpatialImageInGeneration, type RenderSpatialContext } from './render-spatial-context';
import { lightingPhrase, selectedViewImagePrompt } from './selected-view-image-prompt';
import { acceptedInteriorPrompt } from './accepted-interior-prompt';
import { propertySunPrompt } from '@/lib/editor-document/property-orientation';
import { isolateZoneReference } from './zone-isolated-image';
import { renderCameraRoomGuide } from './render-camera-room-guide';
import { acceptedTopForView } from './accepted-top-reference';
import { simplePlanPrompt, simpleSectionPrompt } from './simple-plan-prompt';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { planFurnitureLines } from './furniture-views';
import { planRasterBounds } from './rasterize-editor-document';
import { UserFacingError } from '@/server/errors/user-facing-error';
import type { Point } from '@/lib/editor-document/schema';
import { exteriorDesignContext } from '@/lib/editor-document/exterior-design-context';
import { criticalFixtureGroups } from '@/lib/editor-document/critical-fixtures';
import type { SectionFurnitureBrief } from './section-furniture-brief';
import { confirmedSectionFurniture } from './section-confirmed-furniture';
import type { SectionSide } from './section-visibility';
import sharp from 'sharp';

type Image = { base64: string; mimeType: string };
interface Input {
  document: EditorDocument;
  view: RenderView;
  style: Estilo;
  options: RenderDesignOptions;
  objective: string;
  instruction: string;
  reference: RenderReferenceImage;
  zoneMask?: RenderReferenceImage;
  styleAnchor?: Image | null;
  /** La ancla es la cenital aceptada: fija el interiorismo de los laterales. */
  acceptedDesign?: boolean;
  describeInterior?: (accepted: Image) => Promise<{ brief: string[]; detail?: Image }>;
  environment?: Image;
  spatial: { context: RenderSpatialContext; image: Image };
  /** Plano 2D de la cenital completa: sustituye a la captura 3D y al prompt largo. */
  plan?: RenderReferenceImage;
  /** Sección 2D de un alzado con sus estancias abiertas: sustituye a la captura 3D y al prompt largo. */
  section?: {
    image: RenderReferenceImage; rooms: { name: string; boundary: Point[]; visibilityHint?: string }[];
    /** Lectura del mobiliario de cada estancia en la cenital girada, tal como lo verá la cámara. */
    describe?: (acceptedTop: Image, rooms: string[], visibilityHints: string[]) => Promise<SectionFurnitureBrief>;
    /** La misma sección con las camas y sofás indicados dibujados. */
    withFurniture?: (ids: string[]) => Promise<RenderReferenceImage | undefined>;
  };
}

/** La cámara es la referencia principal. El mapa cenital se reserva para generar cenitales y auditar. */
export async function prepareRenderImageRequest(input: Input) {
  const { document, view, style, options, objective, instruction, acceptedDesign, environment, spatial } = input;
  if (input.section && input.styleAnchor) {
    const rooms = input.section.rooms;
    if (!rooms.length) throw new UserFacingError('No se han podido identificar las estancias abiertas de esta sección. Revisa el plano antes de generar la vista.');
    // Estancias del contexto espacial abiertas en la sección, de izquierda a derecha: la auditoría exige verlas todas.
    const spatialRooms = spatial.context.levels.flatMap((level) => level.rooms);
    const sectionRooms = rooms.flatMap((open) => spatialRooms.filter((room) => pointInPolygon(room.anchor, open.boundary)))
      .map(room => ({ id: room.id, name: room.name,
        visibilityHint: rooms.find(open => pointInPolygon(room.anchor, open.boundary))?.visibilityHint }));
    // La cenital se recorta a esas estancias y se gira como la cámara.
    const guide = { rooms: sectionRooms.map((room) => ({ ...room, x: 0, y: 0 })) };
    const anchor = await acceptedTopForView(input.styleAnchor, view.preset, document, spatial.context, guide);
    const names = rooms.map((room) => room.name);
    const hints = rooms.map(room => room.visibilityHint ?? '');
    const brief = await input.section.describe?.(anchor, names, hints);
    if (!brief || brief.lines.length !== names.length)
      throw new UserFacingError('No se pudo leer el mobiliario de todas las estancias en la cenital aceptada. Se ha detenido la vista antes de generar una imagen.');
    const confirmed = confirmedSectionFurniture(document, view.preset as SectionSide, rooms, brief.pieces);
    const drawn = confirmed.ids.length ? await input.section.withFurniture?.(confirmed.ids) : undefined;
    const { image, aspectRatio } = await fitRenderReferenceAspect(drawn ?? input.section.image);
    const sectionFurniture = drawn ? confirmed.lines : [];
    const prompt = simpleSectionPrompt(view.preset, style, options, objective, instruction, names, brief.lines, hints, document, sectionFurniture);
    return { request: { prompt, compactPrompt: prompt, aspectRatio, referenceImages: [image, anchor] } as ImageGenRequest,
      reference: image, zoneMask: undefined, styleAnchor: anchor, sectionRooms, sectionFurniture };
  }
  if (input.plan) {
    const { image, aspectRatio } = await fitRenderReferenceAspect(input.plan);
    const prompt = simplePlanPrompt(style, options, objective, instruction, spatial.context,
      planFurnitureLines(document, spatial.context.levels.flatMap((level) => level.rooms)), exteriorDesignContext(document), criticalFixtureGroups(document),
      planRasterBounds(document), document);
    const request: ImageGenRequest = { prompt, compactPrompt: prompt, aspectRatio, referenceImages: [image] };
    return { request, reference: image, zoneMask: undefined, styleAnchor: undefined };
  }
  const isolated = input.zoneMask ? await isolateZoneReference(input.reference, input.zoneMask) : undefined;
  const { image: reference, mask: zoneMask, aspectRatio } = await fitRenderReferenceAspect(isolated?.image ?? input.reference, isolated?.mask);
  const acceptedInterior = Boolean(view.roomId && input.styleAnchor && acceptedDesign);
  const cameraGuide = includeSpatialImageInGeneration(view) || acceptedInterior ? undefined : await renderCameraRoomGuide(document, view,
    spatial.context, reference, { sourceWidth: input.reference.width, sourceHeight: input.reference.height,
      crop: isolated?.crop ?? { left: 0, top: 0, width: input.reference.width, height: input.reference.height } }, zoneMask);
  const styleAnchor = input.styleAnchor && acceptedDesign
    ? await acceptedTopForView(input.styleAnchor, view.preset, document, spatial.context, cameraGuide) : input.styleAnchor;
  let prompt = selectedViewImagePrompt(document, view, style, options, objective, instruction,
    Boolean(zoneMask), Boolean(styleAnchor), Boolean(environment), spatial.context, cameraGuide, Boolean(styleAnchor && acceptedDesign));
  let interiorDetail: Image | undefined;
  let acceptedBrief: string[] | undefined;
  if (acceptedInterior && styleAnchor) {
    const description = await input.describeInterior?.(styleAnchor), brief = description?.brief;
    acceptedBrief = brief;
    interiorDetail = description?.detail;
    if (!brief?.length) throw new UserFacingError('No se pudo leer el mobiliario del interior en la cenital aceptada.');
    prompt += `\nAPARIENCIA LEÍDA DEL DISEÑO ACEPTADO: ${brief.join('; ')}. La guía geométrica gris no fija el modelo de los muebles: reemplaza sus formas por estas, manteniendo arquitectura y cámara. No copies las sillas, taburetes ni textiles de la maqueta.`;
    prompt += '\nConserva también los colores secundarios del diseño aceptado: cojines, mantas, brazos y laterales de los sofás. No conviertas cojines de color en cojines neutros. No añadas cuero, madera o paneles contrastantes a un sofá tapizado. Para caras ocultas prolonga prudentemente el material visible del mismo mueble, sin inventar otro modelo.';
    if (interiorDetail) prompt += '\nDespués de la cenital completa se adjunta un recorte de esa misma imagen aceptada, sin girar, de la estancia solicitada. Es detalle de apariencia, NO otra cámara ni otro diseño; conserva las formas que se ven ahí. La primera imagen sigue fijando la cámara final.';
    if (view.architectureOnly) prompt = [acceptedInteriorPrompt(view, spatial.context, brief, Boolean(interiorDetail), lightingPhrase(options), document),
      propertySunPrompt(document, options.lighting)].filter(Boolean).join('\n');
  }
  if (view.architectureOnly) prompt += '\nLa primera imagen es una guía de ARQUITECTURA SIN MOBILIARIO. Su ausencia de muebles es intencionada: incorpora los del diseño aceptado. El azul opaco en la cubierta marca CRISTAL REAL, que debes representar transparente conservando su forma y la estructura de la referencia exterior aceptada. No lo sustituyas por cielo abierto. No copies ese azul como acabado final.';
  // Una sola guía geométrica neutra: duplicar la maqueta coloreada imponía sus muebles sobre el diseño aceptado.
  const generationReference = acceptedInterior && !view.architectureOnly ? { ...reference, base64: (await sharp(Buffer.from(reference.base64, 'base64'))
    .greyscale().png().toBuffer()).toString('base64'), mimeType: 'image/png' } : reference;
  const request: ImageGenRequest = {
    prompt, compactPrompt: prompt, aspectRatio,
    referenceImages: [generationReference,
      ...(zoneMask ? [zoneMask] : []),
      ...(styleAnchor ? [styleAnchor] : []),
      ...(interiorDetail ? [interiorDetail] : []),
      ...(environment ? [environment] : []),
      ...(includeSpatialImageInGeneration(view) ? [spatial.image] : []),
      ...(cameraGuide?.image ? [cameraGuide.image] : []),
    ],
  };
  // La auditoría compara con la misma cenital, recortada y girada, que recibió el generador.
  return { request, reference, zoneMask, styleAnchor, acceptedBrief };
}
