import type { Estilo, ImageGenRequest } from '@/lib/contracts';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { fitRenderReferenceAspect, type RenderReferenceImage } from './render-reference-frame';
import { includeSpatialImageInGeneration, type RenderSpatialContext } from './render-spatial-context';
import { selectedViewImagePrompt } from './selected-view-image-prompt';
import { isolateZoneReference } from './zone-isolated-image';
import { renderCameraRoomGuide } from './render-camera-room-guide';
import { acceptedTopForView } from './accepted-top-reference';
import { simplePlanPrompt, simpleSectionPrompt } from './simple-plan-prompt';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import { planFurnitureLines } from './furniture-views';
import { sectionFurnitureDescription, type ElevationSide } from './rasterize-editor-elevation';
import type { Point } from '@/lib/editor-document/schema';

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
  environment?: Image;
  spatial: { context: RenderSpatialContext; image: Image };
  /** Plano 2D de la cenital completa: sustituye a la captura 3D y al prompt largo. */
  plan?: RenderReferenceImage;
  /** Sección 2D de un alzado con sus estancias abiertas: sustituye a la captura 3D y al prompt largo. */
  section?: {
    image: RenderReferenceImage; rooms: { name: string; boundary: Point[] }[];
    /** Lectura del mobiliario de cada estancia en la cenital girada, tal como lo verá la cámara. */
    describe?: (acceptedTop: Image, rooms: string[]) => Promise<string[]>;
  };
}

/** La cámara es la referencia principal. El mapa cenital se reserva para generar cenitales y auditar. */
export async function prepareRenderImageRequest(input: Input) {
  const { document, view, style, options, objective, instruction, acceptedDesign, environment, spatial } = input;
  if (input.section && input.styleAnchor) {
    const { image, aspectRatio } = await fitRenderReferenceAspect(input.section.image);
    const rooms = input.section.rooms;
    // Estancias del contexto espacial abiertas en la sección, de izquierda a derecha: la auditoría exige verlas todas.
    const spatialRooms = spatial.context.levels.flatMap((level) => level.rooms);
    const sectionRooms = rooms.flatMap((open) => spatialRooms.filter((room) => pointInPolygon(room.anchor, open.boundary)))
      .map((room) => ({ id: room.id, name: room.name }));
    // La cenital se recorta a esas estancias y se gira como la cámara.
    const guide = { rooms: sectionRooms.map((room) => ({ ...room, x: 0, y: 0 })) };
    const anchor = await acceptedTopForView(input.styleAnchor, view.preset, document, spatial.context, guide);
    const names = rooms.map((room) => room.name);
    // Con muebles en el plano, la sección ya los dibuja y su descripción es exacta; sin ellos, se leen de la cenital.
    const drawn = sectionFurnitureDescription(document, view.preset as ElevationSide, rooms);
    const furniture = drawn.length ? drawn : await input.section.describe?.(anchor, names) ?? [];
    const prompt = simpleSectionPrompt(view.preset, style, options, objective, instruction, names, furniture, drawn.length > 0);
    return { request: { prompt, compactPrompt: prompt, aspectRatio, referenceImages: [image, anchor] } as ImageGenRequest,
      reference: image, zoneMask: undefined, styleAnchor: anchor, sectionRooms };
  }
  if (input.plan) {
    const { image, aspectRatio } = await fitRenderReferenceAspect(input.plan);
    const prompt = simplePlanPrompt(style, options, objective, instruction, spatial.context,
      planFurnitureLines(document, spatial.context.levels.flatMap((level) => level.rooms)));
    const request: ImageGenRequest = { prompt, compactPrompt: prompt, aspectRatio, referenceImages: [image] };
    return { request, reference: image, zoneMask: undefined, styleAnchor: undefined };
  }
  const isolated = input.zoneMask ? await isolateZoneReference(input.reference, input.zoneMask) : undefined;
  const { image: reference, mask: zoneMask, aspectRatio } = await fitRenderReferenceAspect(isolated?.image ?? input.reference, isolated?.mask);
  const cameraGuide = includeSpatialImageInGeneration(view) ? undefined : await renderCameraRoomGuide(document, view,
    spatial.context, reference, { sourceWidth: input.reference.width, sourceHeight: input.reference.height,
      crop: isolated?.crop ?? { left: 0, top: 0, width: input.reference.width, height: input.reference.height } }, zoneMask);
  const styleAnchor = input.styleAnchor && acceptedDesign
    ? await acceptedTopForView(input.styleAnchor, view.preset, document, spatial.context, cameraGuide) : input.styleAnchor;
  const prompt = selectedViewImagePrompt(document, view, style, options, objective, instruction,
    Boolean(zoneMask), Boolean(styleAnchor), Boolean(environment), spatial.context, cameraGuide, Boolean(styleAnchor && acceptedDesign));
  const request: ImageGenRequest = {
    prompt, compactPrompt: prompt, aspectRatio,
    referenceImages: [reference,
      ...(zoneMask ? [zoneMask] : []),
      ...(styleAnchor ? [styleAnchor] : []),
      ...(environment ? [environment] : []),
      ...(includeSpatialImageInGeneration(view) ? [spatial.image] : []),
      ...(cameraGuide?.image ? [cameraGuide.image] : []),
    ],
  };
  // La auditoría compara con la misma cenital, recortada y girada, que recibió el generador.
  return { request, reference, zoneMask, styleAnchor };
}
