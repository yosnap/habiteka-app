import sharp from 'sharp';
import type { ChatVisionAdapter, JsonSchema, MessagePart } from '@/lib/contracts';
import type { OrgContext } from '@/server/auth/org-context';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { pointInPolygon } from '@/lib/editor-document/polygon-tools';
import type { FaceSide } from '@/lib/editor-document/room-wall-faces';
import type { SketchFurnitureReading, StudioState } from '@/lib/studio-state';
import { getFurnitureCatalogEntry } from '@/lib/editor-document/furniture-catalog';
import { loadStudio, saveStudio } from '@/server/plan/studio-repo';
import { readStudioImage } from '@/server/plan/studio-image';
import { buildPlanImport } from '@/server/plan/build-plan-import';
import { matchSketchItem, type SketchRole } from './sketch-catalog-match';

/** Mueble que se leyó en el boceto, ya en milímetros del plano y emparejado con el catálogo. */
export interface SketchGuideItem {
  label: string;
  /** Estancia rotulada en el boceto, tal como la leyó la IA. */
  roomLabel?: string;
  /**
   * Perfil de la pieza (bed, cabinet, sofa…), `kitchen` para un tramo de encimera, `chair` para las sillas de una mesa o
   * `bar` para la isla, la península o la mesa alta de la cocina americana.
   */
  kind: string;
  centreMm: Point;
  sizeMm: { x: number; y: number };
  /** Lado hacia el que queda su trasera en el dibujo; null si va exenta o no se leyó. */
  back: FaceSide | null;
  count: number;
  catalogId?: string;
  role?: SketchRole;
  /** No hay en el catálogo nada así: se avisa al cliente en lugar de inventar un sustituto. */
  missing: boolean;
}
/**
 * El boceto con el que el cliente importó el plano: su distribución deseada. La imagen se alinea con el plano por su
 * esquina (0, 0) y `frameMm`, igual que el «original» del editor.
 */
export interface SketchGuide { image: MessagePart; frameMm: { width: number; height: number }; items: SketchGuideItem[] }


const GUIDE_WIDTH_PX = 1400, READING_WIDTH_PX = 1600;
/** Sube al mejorar la lectura: los proyectos con una lectura anterior se releen solos la siguiente vez. */
const READING_VERSION = 2;
const SIDES = ['arriba', 'abajo', 'izquierda', 'derecha'] as const;

const READING_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['room', 'item', 'bbox', 'back', 'count'], properties: { room: { type: 'string' }, item: { type: 'string' },
      bbox: { type: 'object', additionalProperties: false, required: ['minX', 'minY', 'maxX', 'maxY'],
        properties: { minX: { type: 'number' }, minY: { type: 'number' }, maxX: { type: 'number' }, maxY: { type: 'number' } } },
      back: { type: 'string', enum: [...SIDES, 'ninguno'] }, count: { type: 'integer' } } } } },
};

const READING_PROMPT = [
  'Es el boceto a mano de una vivienda. Enumera TODOS los muebles, aparatos, sanitarios, plantas y objetos dibujados, uno por uno (cada mesilla, cada planta; las sillas de una mesa, juntas con count), con la estancia rotulada en la que están.',
  'item: nombre concreto en español (cama doble, cama individual, mesilla, lámpara de mesa, armario, escritorio, silla de escritorio, sofá en L, mesa de centro, mueble de TV, butaca, alfombra, bañera, lavabo, inodoro, plato de ducha, lavadora, pila de lavadero, encimera con placa, encimera con fregadero, frigorífico, isla de cocina, barra americana, península, mesa alta, taburetes, mesa de cocina, sillas, mesa de comedor, mesa redonda de exterior, planta, zapatero, mueble columna, felpudo, cesto, cuna, litera, consola, espejo, perchero, secadora, tendedero, estantería metálica…). Si una encimera dobla en L, da un elemento por tramo.',
  'Cómo se dibuja: un armario es un rectángulo largo contra la pared, a menudo rayado o con perchas; una mesilla, un cuadrado pequeño junto al cabecero de la cama (mira a ambos lados); un escritorio, un rectángulo contra la pared con una silla delante; la placa, cuatro círculos; el fregadero, un rectángulo con seno; la nevera, un rectángulo aparte a veces con un asterisco.',
  'Cocina americana: la barra o península es un rectángulo estrecho que sale de la encimera o separa la cocina del salón, y la isla un rectángulo exento en mitad de la cocina; los taburetes son círculos o cuadrados pequeños a lo largo de ella (dalos juntos, con count). Da la barra como un elemento propio, no como tramo de encimera.',
  'Una lámpara sobre una mesilla (un círculo, a veces con aspa) es un elemento aparte, «lámpara de mesa», con su propia caja. Una alfombra es un rectángulo u óvalo grande, a veces con flecos o trama, bajo el sofá, la mesa o la cama: da su caja completa, la que ocupa en el dibujo.',
  'bbox: caja en coordenadas de la imagen de 0 a 1 (x hacia la derecha, y hacia abajo). back: hacia qué lado de la imagen queda la trasera de la pieza (cabecero de la cama, respaldo, cisterna, fondo del armario o de la encimera); ninguno para mesas, alfombras y plantas. count: cuántas piezas iguales representa, 1 si es una.',
].join('\n');

/** Una llamada de visión con algo de razonamiento: unos 17 s y 0,03 $, y se guarda para no repetirla. */
async function readSketchFurniture(chat: ChatVisionAdapter, base64: string): Promise<SketchFurnitureReading['items']> {
  const image = (await sharp(Buffer.from(base64, 'base64')).resize({ width: READING_WIDTH_PX, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString('base64');
  const result = await chat.chat({ model: '', responseSchema: READING_SCHEMA, temperature: 0, maxTokens: 16000, reasoning: { effort: 'low' },
    messages: [{ role: 'user', content: [{ type: 'text', text: READING_PROMPT }, { type: 'image_url', base64: image, mimeType: 'image/jpeg' }] }] });
  const items = (result.structured as { items?: unknown } | undefined)?.items;
  return (Array.isArray(items) ? items : []).flatMap((raw) => {
    const item = raw as SketchFurnitureReading['items'][number];
    const box = item?.bbox, valid = box && [box.minX, box.minY, box.maxX, box.maxY].every((value) => Number.isFinite(value) && value >= 0 && value <= 1);
    return valid && typeof item.item === 'string' && box.maxX > box.minX && box.maxY > box.minY
      ? [{ room: String(item.room ?? ''), item: item.item.slice(0, 80), bbox: box, back: SIDES.includes(item.back as FaceSide) ? item.back : 'ninguno',
        count: Number.isInteger(item.count) && item.count > 0 ? Math.min(item.count, 20) : 1 }] : [];
  });
}

/**
 * El boceto solo guía si es el del plano del editor: si se importa otro dibujo y no se aplica, sus muebles caerían en
 * estancias que no son las suyas. El contorno total de la importación debe coincidir con el del plano (otra lectura del
 * mismo dibujo puede salir a otra escala) y la mayoría de las estancias del editor caer dentro de las importadas.
 */
function matchesDocument(zones: readonly { outline: Point[] }[], document: EditorDocument): boolean {
  const rooms = deriveRooms(document);
  if (!rooms.length || !zones.length) return false;
  const box = (points: readonly Point[]) => { const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }; };
  const plan = box(rooms.flatMap((room) => room.boundary)), sketch = box(zones.flatMap((zone) => zone.outline));
  if (Math.abs(plan.width - sketch.width) > plan.width * .08 || Math.abs(plan.height - sketch.height) > plan.height * .08
    || Math.abs(plan.minX - sketch.minX) > 400 || Math.abs(plan.minY - sketch.minY) > 400) return false;
  const inside = rooms.filter((room) => {
    const xs = room.boundary.map((point) => point.x), ys = room.boundary.map((point) => point.y);
    const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    return zones.some((zone) => pointInPolygon(centre, zone.outline));
  });
  return inside.length >= rooms.length * .7;
}

type Box = SketchFurnitureReading['items'][number]['bbox'];
const area = (box: Box) => (box.maxX - box.minX) * (box.maxY - box.minY);
/**
 * La lectura detallada nombra bien cada objeto pero da cajas aproximadas (la mesa del comedor casi cuadrada); la
 * extracción de la importación medía mejor. Si una caja de la importación coincide con la leída (al menos un 35 % de la
 * menor queda dentro de la otra, y no es un bloque mucho mayor, como la encimera entera de la cocina), manda su medida.
 */
function measuredBox(read: Box, kind: string, measured: readonly { bbox: Box; tipo: string }[]): Box {
  const overlap = (other: Box) => {
    const width = Math.min(read.maxX, other.maxX) - Math.max(read.minX, other.minX), height = Math.min(read.maxY, other.maxY) - Math.max(read.minY, other.minY);
    const shared = width > 0 && height > 0 ? width * height : 0;
    return shared / Math.min(area(read), area(other));
  };
  // Solo de su mismo tipo: la pila del lavadero no puede tomar la caja de la lavadora de al lado.
  const same = measured.filter(({ bbox, tipo }) => tipo === kind && area(bbox) <= area(read) * 3);
  const best = same.map(({ bbox }) => ({ other: bbox, score: overlap(bbox) })).sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= .35) return best.other;
  // Sin solape, la del mismo tipo más cercana (a menos de un 10 % de la imagen): la lavadora leída caía fuera del muro.
  const centre = (box: Box) => ({ x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }), at = centre(read);
  const near = same.map(({ bbox }) => ({ other: bbox, distance: Math.hypot(centre(bbox).x - at.x, centre(bbox).y - at.y) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return near && near.distance <= .1 ? near.other : read;
}

/** Objeto leído (caja 0–1 de la imagen) en milímetros del plano, emparejado con su pieza o su papel del catálogo. */
export function guideItem(label: string, roomLabel: string | undefined, bbox: SketchFurnitureReading['items'][number]['bbox'], back: FaceSide | null, count: number,
  frame: { width: number; height: number }): SketchGuideItem {
  const match = matchSketchItem(label), profile = match?.catalogId ? getFurnitureCatalogEntry(match.catalogId)?.profile ?? '' : '';
  return { label, ...(roomLabel ? { roomLabel } : {}), back, count, missing: !match,
    kind: match?.role === 'kitchen' ? 'kitchen' : match?.role === 'chairs' ? 'chair' : match?.role === 'bar' ? 'bar' : profile.startsWith('sofa') ? 'sofa' : profile,
    ...(match?.catalogId ? { catalogId: match.catalogId } : {}), ...(match?.role ? { role: match.role } : {}),
    centreMm: { x: Math.round((bbox.minX + bbox.maxX) / 2 * frame.width), y: Math.round((bbox.minY + bbox.maxY) / 2 * frame.height) },
    sizeMm: { x: Math.round((bbox.maxX - bbox.minX) * frame.width), y: Math.round((bbox.maxY - bbox.minY) * frame.height) } };
}

/**
 * Boceto del plano principal con sus muebles. La primera vez se lee objeto por objeto (la extracción de la importación
 * solo daba cajas gruesas: la encimera de la cocina en un bloque, la lavadora como un horno) y la lectura se guarda en el
 * estudio; si la lectura falla, se usan las cajas de la importación. Sin importación, sin imagen o en una zona, no hay guía.
 */
export async function loadSketchGuide(ctx: OrgContext, projectId: string, zoneId: string | null, chat?: ChatVisionAdapter,
  document?: EditorDocument): Promise<SketchGuide | null> {
  if (zoneId) return null;
  try {
    const studio = await loadStudio(ctx, projectId), imported = studio.planImport;
    if (!imported?.image) return null;
    const built = buildPlanImport(imported.raw, {
      generalWidthMm: imported.generalWidthMm, roomOverrides: imported.roomOverrides, doorOverrides: imported.doorOverrides,
      wallOverrides: imported.wallOverrides, includeFurniture: false,
      normalize: imported.detected ? { wallsOverride: imported.detected.walls, imageHeightOverWidth: imported.detected.heightOverWidth } : {},
    });
    const frame = built.sourceFrameMm;
    if (!frame || (document && !matchesDocument(built.plano.zones, document))) return null;
    const source = await readStudioImage(imported.image), assetKey = imported.image.assetKey ?? imported.image.assetUrl.slice(0, 200);
    const cached = imported.furnitureReading;
    let reading = cached?.assetKey === assetKey && (cached.version ?? 1) >= READING_VERSION ? cached.items : undefined;
    if (!reading && chat) {
      reading = await readSketchFurniture(chat, source.base64).catch(() => undefined);
      if (reading?.length) await saveStudio(ctx, projectId, { ...studio, planImport: { ...imported, furnitureReading: { assetKey, version: READING_VERSION, items: reading } } } as StudioState).catch(() => {});
    }
    const boxes = (imported.raw.mobiliario ?? []).map(({ bbox, tipo }) => ({ bbox, tipo }));
    const items = reading?.length
      ? reading.map((item) => {
        const read = guideItem(item.item, item.room, item.bbox, item.back === 'ninguno' ? null : item.back, item.count, frame);
        return guideItem(item.item, item.room, measuredBox(item.bbox, read.kind, boxes), read.back, item.count, frame);
      })
      : (imported.raw.mobiliario ?? []).map((item) => guideItem(item.etiqueta?.trim() || item.tipo, undefined, item.bbox, null, 1, frame));
    if (!items.length) return null;
    const image = await sharp(Buffer.from(source.base64, 'base64')).resize({ width: GUIDE_WIDTH_PX, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    return { image: { type: 'image_url', base64: image.toString('base64'), mimeType: 'image/jpeg' }, frameMm: { width: Math.round(frame.width), height: Math.round(frame.height) }, items };
  } catch {
    // Una importación antigua que ya no se puede recalcular no impide amueblar.
    return null;
  }
}
