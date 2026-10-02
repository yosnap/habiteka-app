/**
 * Comandos puros de zonas de luces guardadas. Suben el documento a v12 con
 * `upgradeLightingDocument` y cierran con `parseEditorDocument`, que es quien
 * valida el contorno. Una zona es geometría con nombre: borrarla no toca
 * ninguna luz ni ninguna tira, y borrar luces no invalida zonas.
 */
import type { EditorDocument, LightZone, Point } from './schema';
import { parseEditorDocument } from './validation';
import { upgradeLightingDocument } from './lighting-migration';
import { MAX_LIGHT_ZONES, MAX_ZONE_NAME_LENGTH, MAX_ZONE_PARTS } from './light-zone-validation';

/** Copia defensiva de los contornos: el documento nunca comparte puntos con quien dibuja. */
function parts(polygonsMm: readonly (readonly Point[])[]): Point[][] {
  if (!polygonsMm.length || polygonsMm.length > MAX_ZONE_PARTS)
    throw new Error(`Una zona admite entre 1 y ${MAX_ZONE_PARTS} contornos`);
  return polygonsMm.map((polygon) => polygon.map((point) => ({ x: point.x, y: point.y })));
}

function find(doc: EditorDocument, id: string): LightZone {
  const zone = doc.lightZones?.find((item) => item.id === id);
  if (!zone) throw new Error('Zona de luces inexistente');
  return zone;
}

/** Nombre válido y libre: el nombre es lo que identifica la zona para el usuario. */
function assertName(doc: EditorDocument, name: string, exceptId?: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_ZONE_NAME_LENGTH)
    throw new Error(`Pon un nombre a la zona (1–${MAX_ZONE_NAME_LENGTH} caracteres)`);
  if (doc.lightZones?.some((item) => item.id !== exceptId && item.name.trim() === trimmed))
    throw new Error('Ya hay otra zona de luces con ese nombre');
  return trimmed;
}

export function addLightZone(
  source: EditorDocument,
  name: string,
  polygonsMm: readonly (readonly Point[])[],
): EditorDocument {
  const doc = upgradeLightingDocument(source);
  if (doc.lightZones!.length >= MAX_LIGHT_ZONES)
    throw new Error(`El proyecto ya tiene ${MAX_LIGHT_ZONES} zonas de luces: borra una para crear otra`);
  doc.lightZones!.push({
    id: crypto.randomUUID(),
    name: assertName(doc, name),
    polygonsMm: parts(polygonsMm),
  });
  return parseEditorDocument(doc);
}

export function renameLightZone(source: EditorDocument, id: string, name: string): EditorDocument {
  const doc = upgradeLightingDocument(source);
  const zone = find(doc, id);
  zone.name = assertName(doc, name, id);
  return parseEditorDocument(doc);
}

/** Redibuja la zona conservando su nombre: útil tras remodelar el plano. */
export function setLightZonePolygons(
  source: EditorDocument,
  id: string,
  polygonsMm: readonly (readonly Point[])[],
): EditorDocument {
  const doc = upgradeLightingDocument(source);
  find(doc, id).polygonsMm = parts(polygonsMm);
  return parseEditorDocument(doc);
}

export function removeLightZone(source: EditorDocument, id: string): EditorDocument {
  const doc = parseEditorDocument(source);
  doc.lightZones = doc.lightZones?.filter((item) => item.id !== id);
  return parseEditorDocument(doc);
}
