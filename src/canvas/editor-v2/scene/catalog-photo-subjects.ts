import { getFurnitureCatalogEntry, type FurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { furnitureModel, modelTint } from '@/lib/editor-document/furniture-models';
import { liftsOverhead, OPENING_TYPES, slideParkingMm, type OpeningType } from '@/lib/editor-document/opening-types';
import { openingTypeLookPatch } from '@/lib/editor-document/opening-look';
import { emptyEditorDocument, type EditorDocument, type Furniture } from '@/lib/editor-document/schema';
import { furnitureSpatial } from '@/lib/editor-document/spatial-properties';
import { FURNITURE_PHOTO_VIEW, OPENING_PHOTO_VIEW, type PhotoView } from './catalog-photo-framing';
import { furnitureSceneBoxes } from './editor-document-to-scene';
import { openingMeshes } from './opening-meshes';
import type { SceneBox } from './types';
import { wallMeshes } from './wall-meshes';

/**
 * Versión del estudio de fotos del catálogo. Súbela al cambiar luz, encuadre, fondo o tamaño de la foto: las fotos
 * guardadas en el navegador llevan esta versión en su clave y las antiguas se descartan.
 */
export const CATALOG_PHOTO_VERSION = 2;

/** Lo que se fotografía: el mismo GLB del 3D (escalado a las medidas de la pieza) o los mismos sólidos de la escena. */
export type RenderedPhotoSource = { key: string; view: PhotoView } & (
  | { kind: 'model'; url: string; frontRotation: number; tint?: string; tintMaterialNames?: readonly string[];
    /** Ancho, alto y fondo en metros. */
    sizeM: [number, number, number]; front: 1 }
  | { kind: 'boxes'; boxes: SceneBox[];
    /** Cara que mira a la cámara: +Z (delante del mueble) o −Z (la cara del muro hacia la que abre la hoja). */
    front: 1 | -1 });

/**
 * Foto de la tarjeta: una miniatura pregenerada (render de producto hecho fuera del navegador, p. ej. con Cycles) o la
 * que se renderiza en el navegador. La pregenerada conserva el render como respaldo si su imagen no carga.
 */
export type CatalogPhotoSource = RenderedPhotoSource | { kind: 'image'; key: string; url: string; render: RenderedPhotoSource | null };

/**
 * URL de una miniatura pregenerada declarada como `thumbnailUrl` opcional en el modelo o en la entrada del catálogo
 * (manda la del modelo). Se lee sin suponer que el campo exista y solo se acepta una ruta del sitio o una URL https.
 */
export function pregeneratedThumbnailUrl(candidates: readonly unknown[]): string | null {
  for (const candidate of candidates) {
    const value = candidate && typeof candidate === 'object' ? (candidate as { thumbnailUrl?: unknown }).thumbnailUrl : undefined;
    const url = typeof value === 'string' ? value.trim() : '';
    if ((url.startsWith('/') && !url.startsWith('//')) || url.startsWith('https://')) return url;
  }
  return null;
}

/**
 * Muro de la foto de puertas y ventanas: un trozo justo para enmarcarla, con paño a cada lado, encima (hasta la guía y
 * las ruedas de una de granero) y bajo el alféizar. Una corredera vista lleva además el paño por el que se recoge.
 */
const WALL_SIDE_MM = 220, WALL_HEAD_MM = 260, WALL_SILL_MM = 380, WALL_THICKNESS_MM = 200, SLIDE_MARGIN_MM = 80;
/** Paño en gris piedra claro: los marcos blancos y las hojas de madera se recortan sobre él. */
const WALL_COLOR = '#a39a8d';

/**
 * Apertura de la puerta en su foto: las abatibles, entornadas para que se vea su giro sin tapar su diseño; correderas y
 * plegables, a medio recorrido. Las de entrada y las de garaje que suben se ven cerradas, desde la calle.
 */
function photoOpenAngle(type: OpeningType): number {
  if (type.kind !== 'puerta' || type.entrance || liftsOverhead(type)) return 0;
  // La pivotante, algo más abierta: así se ve el tramo de hoja que pasa al otro lado de su eje.
  return type.pivotRatio ? 38 : type.operation === 'abatible' ? 24 : 45;
}

/** Huella corta y estable (FNV-1a de 32 bits) para claves de caché derivadas de geometría. */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(36);
}

const boxesKey = (scope: string, boxes: SceneBox[]) =>
  [`v${CATALOG_PHOTO_VERSION}`, scope, hashText(JSON.stringify(boxes)), boxes.length].join('|');

/** La pieza tal como entra al plano desde el catálogo, apoyada en el suelo para la foto. */
export function catalogEntryFurniture(entry: FurnitureCatalogEntry): Furniture {
  return { id: 'catalog-photo', kind: entry.kind, catalogId: entry.id, x: 0, y: 0, widthMm: entry.widthMm, depthMm: entry.depthMm,
    rotation: 0, dimensionalOrigin: 'physical', heightMm: entry.heightMm, elevationMm: 0, color: entry.color };
}

/** Foto de un mueble: la miniatura pregenerada de su modelo o de su pieza del catálogo si la hay; si no, el render. */
export function furniturePhotoSource(item: Furniture): CatalogPhotoSource | null {
  const render = renderedFurnitureSource(item);
  const url = pregeneratedThumbnailUrl([furnitureModel(item), getFurnitureCatalogEntry(item.catalogId)]);
  return url ? { kind: 'image', key: url, url, render } : render;
}

/**
 * Render de un mueble: su modelo realista si lo tiene (con su tinte y medidas) o sus volúmenes. La clave cambia con
 * todo lo que cambia la imagen: modelo, orientación, tinte, medidas o la geometría de los volúmenes.
 */
export function renderedFurnitureSource(item: Furniture): RenderedPhotoSource | null {
  const asset = furnitureModel(item);
  if (asset) {
    const tint = modelTint(item), heightMm = furnitureSpatial(item).heightMm;
    const sizes = [item.widthMm, heightMm, item.depthMm];
    if (!sizes.every((value) => Number.isFinite(value) && value > 0)) return null;
    const key = [`v${CATALOG_PHOTO_VERSION}`, 'modelo', asset.url, asset.frontRotation.toFixed(4), (asset.tintMaterialNames ?? []).join(','),
      tint ?? '', ...sizes.map(Math.round)].join('|');
    return { kind: 'model', key, view: FURNITURE_PHOTO_VIEW, url: asset.url, frontRotation: asset.frontRotation, tint, tintMaterialNames: asset.tintMaterialNames,
      sizeM: [sizes[0]! / 1000, sizes[1]! / 1000, sizes[2]! / 1000], front: 1 };
  }
  const boxes = furnitureSceneBoxes(item).filter((box) => box.size.every((value) => Number.isFinite(value) && value > 0));
  return boxes.length ? { kind: 'boxes', key: boxesKey('volumenes', boxes), view: FURNITURE_PHOTO_VIEW, boxes, front: 1 } : null;
}

/** Documento mínimo con un trozo de muro y la puerta o ventana de ese tipo montada en él, con sus medidas por defecto. */
export function openingPhotoDocument(typeId: string): EditorDocument | null {
  const type = OPENING_TYPES.find((item) => item.id === typeId);
  if (!type) return null;
  const base = Math.max(0, type.elevationMm - WALL_SILL_MM), doc = emptyEditorDocument();
  const parking = slideParkingMm({ kind: type.kind, catalogId: type.id, widthMm: type.widthMm, hinge: 'left' });
  const before = Math.max(WALL_SIDE_MM, parking.start + SLIDE_MARGIN_MM), after = Math.max(WALL_SIDE_MM, parking.end + SLIDE_MARGIN_MM);
  const length = type.widthMm + before + after;
  doc.vertices = [{ id: 'inicio', x: 0, y: 0 }, { id: 'fin', x: length, y: 0 }];
  doc.walls = [{ id: 'muro', startVertexId: 'inicio', endVertexId: 'fin', thicknessMm: WALL_THICKNESS_MM, dimensionalOrigin: 'physical',
    baseElevationMm: base, heightMm: type.elevationMm + type.heightMm + WALL_HEAD_MM - base, colors: { left: WALL_COLOR, right: WALL_COLOR } }];
  doc.openings = [{ id: 'abertura', wallId: 'muro', kind: type.kind, position: (before + type.widthMm / 2) / length, widthMm: type.widthMm,
    dimensionalOrigin: 'physical', heightMm: type.heightMm, elevationMm: type.elevationMm, catalogId: type.id,
    // La cámara mira en 3/4 desde la derecha: el canto libre de una ventana (su manilla) queda a la izquierda, a la vista.
    hinge: type.kind === 'ventana' ? 'right' : 'left', swing: 'left',
    openAngleDeg: photoOpenAngle(type), colors: { frame: '#f4f1e9', leaf: '#bb956c' }, ...openingTypeLookPatch(type) }];
  return doc;
}

/** Fuente de la foto de un tipo de puerta o ventana: los mismos sólidos del 3D (muro recortado, marco, hojas y vidrio). */
export function openingPhotoSource(typeId: string): RenderedPhotoSource | null {
  const doc = openingPhotoDocument(typeId);
  if (!doc) return null;
  // El trozo de muro se ve entero de un color: sin el gris de sección en sus cortes, que marcaba juntas en la foto.
  const wall = wallMeshes(doc, doc.walls[0]!).map((box) => ({ ...box, color: WALL_COLOR, topColor: WALL_COLOR }));
  const boxes = [...wall, ...openingMeshes(doc, doc.openings[0]!)];
  // La cámara se pone del lado hacia el que abre la hoja; una ventana, que no abre en el modelo, por su cara interior,
  // la de la manilla. Las de entrada y las de garaje que suben, que abren hacia dentro, se ven desde la calle: cara
  // exterior con pomo, mirilla y paneles.
  const type = OPENING_TYPES.find((item) => item.id === typeId)!;
  const leaves = boxes.filter((box) => box.role === 'leaf' || (box.role !== 'wall' && Math.abs(box.position[2]) > WALL_THICKNESS_MM / 2000));
  const side = leaves.reduce((sum, box) => sum + box.position[2], 0);
  const front = type.kind === 'ventana' ? 1 : type.entrance || liftsOverhead(type) ? -1 : side < 0 ? -1 : 1;
  return { kind: 'boxes', key: boxesKey(`abertura:${typeId}`, boxes), view: OPENING_PHOTO_VIEW, boxes, front };
}
