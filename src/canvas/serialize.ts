/**
 * Serialización del documento del canvas hacia/desde JSONB.
 *
 * El estado en cliente es la fuente de verdad; al persistir se vuelca tal cual a
 * `CanvasState.data`. Al rehidratar se valida de forma defensiva (el payload pudo
 * venir de una versión anterior o estar corrupto): cualquier campo ausente cae a
 * un valor seguro en lugar de romper el render.
 */
import {
  type CanvasDoc,
  type Stroke,
  type StructObj,
  type ProductRef,
  type BaseImage,
  CANVAS_SCHEMA_VERSION,
  emptyCanvasDoc,
} from './types';
import { CATALOG_BY_KIND } from './catalog';

/** Vuelca el documento a un valor JSON serializable (para JSONB). */
export function serializeCanvas(doc: CanvasDoc): unknown {
  return {
    schemaVersion: doc.schemaVersion,
    baseImage: doc.baseImage,
    strokes: doc.strokes,
    objects: doc.objects,
    products: doc.products,
    // La selección es estado de UI efímero: no se persiste.
    selection: null,
  };
}

/** Reconstruye un `CanvasDoc` desde JSONB, tolerante a datos incompletos. */
export function deserializeCanvas(raw: unknown): CanvasDoc {
  if (!isRecord(raw)) return emptyCanvasDoc();
  return {
    schemaVersion:
      typeof raw.schemaVersion === 'number' ? raw.schemaVersion : CANVAS_SCHEMA_VERSION,
    baseImage: parseBaseImage(raw.baseImage),
    strokes: asArray(raw.strokes).map(parseStroke).filter(isPresent),
    objects: asArray(raw.objects).map(parseStruct).filter(isPresent),
    products: asArray(raw.products).map(parseProduct).filter(isPresent),
    selection: null,
  };
}

// --- parsers defensivos ---

function parseBaseImage(v: unknown): BaseImage | null {
  if (!isRecord(v)) return null;
  // width/height deben ser positivos: la capa de fondo escala dividiendo por ellos
  // (un 0 produciría Infinity → NaN en las dimensiones del KonvaImage).
  if (
    typeof v.url !== 'string' ||
    typeof v.width !== 'number' ||
    typeof v.height !== 'number' ||
    v.width <= 0 ||
    v.height <= 0
  ) {
    return null;
  }
  return {
    url: v.url,
    width: v.width,
    height: v.height,
    // Opacidad opcional, acotada a [0,1]; ausente o inválida ⇒ fondo opaco.
    ...(typeof v.opacity === 'number' ? { opacity: Math.min(1, Math.max(0, v.opacity)) } : {}),
  };
}

function parseStroke(v: unknown): Stroke | null {
  if (!isRecord(v) || typeof v.id !== 'string' || !Array.isArray(v.points)) return null;
  const points = v.points.filter((n): n is number => typeof n === 'number');
  return {
    id: v.id,
    points,
    color: typeof v.color === 'string' ? v.color : '#000000',
    width: typeof v.width === 'number' ? v.width : 2,
  };
}

function parseStruct(v: unknown): StructObj | null {
  if (!isRecord(v) || typeof v.id !== 'string') return null;
  // El `kind` debe ser uno del catálogo (estructura o mobiliario). Un kind
  // desconocido (formato futuro) se descarta sin romper el resto del documento.
  if (typeof v.kind !== 'string' || !(v.kind in CATALOG_BY_KIND)) return null;
  return {
    id: v.id,
    kind: v.kind as StructObj['kind'],
    x: num(v.x),
    y: num(v.y),
    width: num(v.width),
    height: num(v.height),
    rotation: num(v.rotation),
    ...(v.flipX === true ? { flipX: true } : {}),
    ...(typeof v.groupId === 'string' ? { groupId: v.groupId } : {}),
  };
}

function parseProduct(v: unknown): ProductRef | null {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.marketplaceItemId !== 'string') {
    return null;
  }
  return {
    id: v.id,
    marketplaceItemId: v.marketplaceItemId,
    x: num(v.x),
    y: num(v.y),
    ...(typeof v.targetRef === 'string' ? { targetRef: v.targetRef } : {}),
  };
}

// --- helpers ---

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function num(v: unknown): number {
  // Exige finitud: NaN/Infinity romperían el render (división por cero en la capa
  // de fondo, atributos SVG inválidos al rasterizar el lienzo). Caen a 0.
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
function isPresent<T>(v: T | null): v is T {
  return v !== null;
}
