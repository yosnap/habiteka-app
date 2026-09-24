/**
 * Comandos puros de tiras LED. Todos suben el documento a v12 con
 * `upgradeLightingDocument`, cierran con `parseEditorDocument` y refrescan la
 * instantánea `pathMm` de las tiras derivadas, para que el fichero guardado,
 * el 2D y el prompt cuenten lo mismo.
 */
import type { EditorDocument, LightStrip, Point } from './schema';
import { parseEditorDocument } from './validation';
import { upgradeLightingDocument } from './lighting-migration';
import { pruneLightingScenes } from './lighting-scene';
import { ceilingSurfaces } from './ceiling-geometry';
import { floorFinish } from './floor-finishes';
import {
  coveRing,
  derivedStripPath,
  lightStripIssue,
  MIN_FREE_STRIP_LENGTH_MM,
  refreshDerivedStripPaths,
  stripKitchenRun,
  underCabinetElevationMm,
  underCabinetPath,
} from './light-strip-geometry';
import {
  MAX_LIGHT_STRIPS,
  MAX_STRIP_ELEVATION_MM,
  MIN_STRIP_POINTS,
  STRIP_DEFAULTS,
  stripLengthMm,
} from './light-strip-types';

/** Campos de una tira que el usuario puede cambiar sin tocar su recorrido. */
export type LightStripPatch = Partial<Pick<LightStrip, 'elevationMm' | 'color' | 'temperatureK' | 'lumensPerMeter' | 'enabled'>>;

function assertPlacement(doc: EditorDocument, strip: LightStrip): void {
  const issue = lightStripIssue(doc, strip);
  if (issue) throw new Error(issue);
}

function find(doc: EditorDocument, id: string): LightStrip {
  const strip = doc.lightStrips?.find((item) => item.id === id);
  if (!strip) throw new Error('Tira LED inexistente');
  return strip;
}

/** Foseado perimetral de un falso techo, en un clic y sin pedir recorrido. */
export function addCoveStrip(source: EditorDocument, ceilingId: string): EditorDocument {
  const doc = upgradeLightingDocument(source);
  if (doc.lightStrips!.length >= MAX_LIGHT_STRIPS) throw new Error(`El plano ya tiene ${MAX_LIGHT_STRIPS} tiras LED`);
  if (doc.lightStrips!.some((item) => item.kind === 'cove' && item.ceilingId === ceilingId))
    throw new Error('Este techo ya tiene foseado');
  const surface = ceilingSurfaces(doc).find((item) => item.ceiling.id === ceilingId);
  if (!surface) throw new Error('Selecciona un techo válido');
  if (surface.ceiling.kind !== 'suspended' || surface.ceiling.dropMm < 80)
    throw new Error('El foseado necesita un falso techo con al menos 8 cm de descenso');
  const pathMm = coveRing(surface.room.boundary);
  if (!pathMm) throw new Error('La estancia es demasiado estrecha para un foseado');
  const floor = floorFinish(doc, surface.room.id).elevationMm ?? 0;
  const strip: LightStrip = {
    id: crypto.randomUUID(), kind: 'cove', ceilingId, ...STRIP_DEFAULTS.cove, pathMm,
    elevationMm: Math.max(0, Math.min(MAX_STRIP_ELEVATION_MM, Math.round(surface.heightMm - floor))),
    enabled: true,
  };
  doc.lightStrips!.push(strip);
  parseEditorDocument(doc);
  assertPlacement(doc, strip);
  return doc;
}

/**
 * Tira bajo los módulos altos de un tramo de cocina, en un clic. Nace derivada:
 * mover, girar o alargar el mueble la arrastra hasta que se retoque a mano.
 */
export function addUnderCabinetStrip(source: EditorDocument, kitchenRunId: string): EditorDocument {
  const doc = upgradeLightingDocument(source);
  if (doc.lightStrips!.length >= MAX_LIGHT_STRIPS) throw new Error(`El plano ya tiene ${MAX_LIGHT_STRIPS} tiras LED`);
  if (doc.lightStrips!.some((item) => item.kind === 'under-cabinet' && item.kitchenRunId === kitchenRunId))
    throw new Error('Este tramo de cocina ya tiene tira bajo los módulos altos');
  const run = doc.kitchenRuns!.find((item) => item.id === kitchenRunId);
  if (!run) throw new Error('Selecciona un tramo de cocina válido');
  if (!run.kitchen.uppers) throw new Error('El tramo de cocina no tiene módulos altos');
  const pathMm = underCabinetPath(run);
  if (!pathMm) throw new Error('El tramo de cocina es demasiado corto para una tira bajo los módulos altos');
  const strip: LightStrip = {
    id: crypto.randomUUID(), kind: 'under-cabinet', kitchenRunId, ...STRIP_DEFAULTS['under-cabinet'], pathMm,
    elevationMm: Math.min(MAX_STRIP_ELEVATION_MM, Math.round(underCabinetElevationMm(run))),
    enabled: true,
  };
  doc.lightStrips!.push(strip);
  parseEditorDocument(doc);
  assertPlacement(doc, strip);
  return doc;
}

/** Tramo libre dibujado a mano: nace desligado de toda geometría. */
export function addFreeStrip(source: EditorDocument, pathMm: readonly Point[], patch: LightStripPatch = {}): EditorDocument {
  const doc = upgradeLightingDocument(source);
  if (doc.lightStrips!.length >= MAX_LIGHT_STRIPS) throw new Error(`El plano ya tiene ${MAX_LIGHT_STRIPS} tiras LED`);
  if (pathMm.length < MIN_STRIP_POINTS) throw new Error('Marca al menos dos puntos del tramo libre');
  if (stripLengthMm(pathMm) < MIN_FREE_STRIP_LENGTH_MM)
    throw new Error(`El tramo libre necesita al menos ${MIN_FREE_STRIP_LENGTH_MM} mm de recorrido`);
  const strip: LightStrip = {
    id: crypto.randomUUID(), kind: 'free', ...STRIP_DEFAULTS.free, ...patch,
    pathMm: pathMm.map((point) => ({ x: point.x, y: point.y })), derived: false, enabled: patch.enabled ?? true,
  };
  doc.lightStrips!.push(strip);
  parseEditorDocument(doc);
  assertPlacement(doc, strip);
  return doc;
}

/** Cambia los campos de una tira; el recorrido se mantiene (y se refresca si es derivada). */
export function updateLightStrip(source: EditorDocument, id: string, patch: LightStripPatch): EditorDocument {
  const doc = upgradeLightingDocument(source);
  const strip = find(doc, id);
  Object.assign(strip, patch);
  refreshDerivedStripPaths(doc);
  parseEditorDocument(doc);
  assertPlacement(doc, strip);
  return doc;
}

/** Mismo cambio en varias tiras; todo o nada, con el motivo del primer fallo. */
export function updateLightStrips(source: EditorDocument, ids: readonly string[], patch: LightStripPatch): EditorDocument {
  if (!ids.length) throw new Error('Selecciona al menos una tira LED');
  let doc = source;
  for (const id of ids) {
    try { doc = updateLightStrip(doc, id, patch); }
    catch (error) {
      throw new Error(`No se aplicó a ninguna de las ${ids.length} tiras: ${error instanceof Error ? error.message : 'cambio no válido'}`);
    }
  }
  return doc;
}

/** Retocar el recorrido a mano desliga la tira de la geometría que seguía. */
export function setLightStripPath(source: EditorDocument, id: string, pathMm: readonly Point[]): EditorDocument {
  const doc = upgradeLightingDocument(source);
  const strip = find(doc, id);
  if (pathMm.length < MIN_STRIP_POINTS) throw new Error('El recorrido necesita al menos dos puntos');
  strip.pathMm = pathMm.map((point) => ({ x: point.x, y: point.y }));
  strip.derived = false;
  parseEditorDocument(doc);
  assertPlacement(doc, strip);
  return doc;
}

/** Devuelve la tira al recorrido derivado; se pierden los retoques a mano. */
export function refitLightStrip(source: EditorDocument, id: string): EditorDocument {
  const doc = upgradeLightingDocument(source);
  const strip = find(doc, id);
  if (strip.kind === 'free') throw new Error('Un tramo libre no sigue a ningún muro: no hay nada que reajustar');
  const path = derivedStripPath(doc, { ...strip, derived: true });
  if (!path) throw new Error(strip.kind === 'under-cabinet'
    ? 'No se puede recalcular el recorrido: revisa el tramo de cocina y sus módulos altos'
    : 'No se puede recalcular el recorrido: revisa la estancia o el falso techo');
  strip.pathMm = path;
  strip.derived = true;
  // La tira de cocina vuelve también a su cota bajo los altos.
  const run = stripKitchenRun(doc, strip);
  if (run) strip.elevationMm = Math.min(MAX_STRIP_ELEVATION_MM, Math.round(underCabinetElevationMm(run)));
  parseEditorDocument(doc);
  assertPlacement(doc, strip);
  return doc;
}

export function removeLightStrip(source: EditorDocument, id: string): EditorDocument {
  return removeLightStrips(source, [id]);
}

export function removeLightStrips(source: EditorDocument, ids: readonly string[]): EditorDocument {
  const doc = parseEditorDocument(source), drop = new Set(ids);
  doc.lightStrips = doc.lightStrips?.filter((item) => !drop.has(item.id));
  // Una escena que apaga una tira borrada dejaría de validar.
  pruneLightingScenes(doc);
  return parseEditorDocument(doc);
}
