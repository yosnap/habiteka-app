import { deriveRooms } from './rooms';
import { designZoneRooms, designZoneStructures, designZonesOverlap } from './design-zone-geometry';
import { MAX_DESIGN_ZONES } from './design-zone-validation';
import { upgradeSpatialDocument } from './spatial-properties';
import { parseEditorDocument } from './validation';
import type { EditorDocument, Point } from './schema';

/** Crear una zona no modifica la construcción ni los acabados ya aplicados. */
export function addDesignZone(source: EditorDocument, name: string, polygon: Point[]): EditorDocument {
  const doc = upgradeSpatialDocument(source);
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 80) throw new Error('Escribe un nombre de hasta 80 caracteres para la zona.');
  if ((doc.designZones ?? []).length >= MAX_DESIGN_ZONES) throw new Error('Ya hay doce zonas de diseño.');
  if (doc.designZones?.some((zone) => zone.name === cleanName)) throw new Error('Ya hay una zona con ese nombre.');
  if (!designZoneRooms({ polygon }, deriveRooms(doc)).length && !designZoneStructures({ polygon }, doc).length)
    throw new Error('La zona debe cubrir un suelo, una escalera o una rampa del plano.');
  if (doc.designZones?.some((zone) => designZonesOverlap(zone, { polygon })))
    throw new Error('Esta zona se superpone a otra. Ajusta el contorno antes de guardarla.');
  doc.designZones = [...(doc.designZones ?? []), { id: crypto.randomUUID(), name: cleanName, polygon }];
  doc.revision += 1;
  return parseEditorDocument(doc);
}

export function renameDesignZone(source: EditorDocument, id: string, name: string): EditorDocument {
  const doc = upgradeSpatialDocument(source), zone = doc.designZones?.find((item) => item.id === id);
  if (!zone) throw new Error('La zona de diseño ya no existe.');
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 80 || doc.designZones?.some((item) => item.id !== id && item.name === cleanName))
    throw new Error('El nombre de la zona está vacío, repetido o es demasiado largo.');
  zone.name = cleanName;
  doc.revision += 1;
  return parseEditorDocument(doc);
}

export function reshapeDesignZone(source: EditorDocument, id: string, polygon: Point[]): EditorDocument {
  const doc = upgradeSpatialDocument(source), zone = doc.designZones?.find((item) => item.id === id);
  if (!zone) throw new Error('La zona de diseño ya no existe.');
  if (!designZoneRooms({ polygon }, deriveRooms(doc)).length && !designZoneStructures({ polygon }, doc).length)
    throw new Error('La zona debe cubrir un suelo, una escalera o una rampa del plano.');
  if (doc.designZones?.some((item) => item.id !== id && designZonesOverlap(item, { polygon })))
    throw new Error('Esta zona se superpone a otra. Ajusta el contorno antes de guardarla.');
  zone.polygon = polygon;
  doc.revision += 1;
  return parseEditorDocument(doc);
}

export function removeDesignZone(source: EditorDocument, id: string): EditorDocument {
  const doc = upgradeSpatialDocument(source);
  if (!doc.designZones?.some((item) => item.id === id)) throw new Error('La zona de diseño ya no existe.');
  doc.designZones = doc.designZones.filter((item) => item.id !== id);
  doc.revision += 1;
  return parseEditorDocument(doc);
}
