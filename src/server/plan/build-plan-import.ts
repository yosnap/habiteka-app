/**
 * Orquestación PURA de la importación de un plano dibujado: extracción cruda
 * (modelo + raster) → normalización → ajuste a cotas escritas → zonas
 * exteriores → mobiliario. Devuelve el `PlanImportResult` que la UI muestra en
 * la tabla de estancias y que, tras corregir el usuario, se materializa en el
 * editor. Sin red ni BD: testeable con fixtures.
 */
import type { PlanImportResult, PlanImportWarning, WrittenRoomDimensions } from '@/lib/contracts';
import type { RawSketch } from '@/server/ai/sketch/sketch-types';
import {
  normalizeSketchDetailed,
  prepareSketch,
  type NormalizeOptions,
} from '@/server/ai/sketch/normalize-geometry';
import { buildPlanFromRooms } from '@/server/ai/sketch/plan-from-rooms';
import { fitPlanToDimensions, type RoomExpectation } from '@/server/ai/sketch/fit-to-dimensions';
import { buildExteriorZones } from '@/server/ai/sketch/exterior-zones';
import { placeFurniture } from '@/server/ai/sketch/place-furniture';
import { cleanupApertures } from '@/server/ai/sketch/aperture-cleanup';
import { planarizePlano } from '@/server/ai/sketch/planarize-plano';

export interface BuildPlanImportOptions {
  normalize?: Partial<NormalizeOptions>;
  /** Medidas corregidas por el usuario en la tabla (prevalecen sobre las leídas). */
  roomOverrides?: WrittenRoomDimensions[];
  /** false = no colocar mobiliario (toggle de la UI). */
  includeFurniture?: boolean;
  /**
   * Ancho total real (mm) confirmado por el usuario cuando el plano no trae
   * cotas generales legibles: fija la escala (isotrópica) y deja de ser estimada.
   */
  generalWidthMm?: number;
}

// Desviación máxima aceptada entre la caja leída y la cota escrita (modo estancias).
const ROOMS_MAX_RELATIVE_CORRECTION = 0.6;

export function buildPlanImport(rawIn: RawSketch, options: BuildPlanImportOptions = {}): PlanImportResult {
  const raw = withConfirmedWidth(rawIn, options.generalWidthMm);
  const warnings: PlanImportWarning[] = [];
  // Con muros medidos y estancias leídas, las estancias SON el plano
  // (reconstrucción cerrada por construcción); si falta alguna de las dos
  // fuentes, se cae a la normalización clásica por regiones.
  const prepared = prepareSketch(raw, options.normalize ?? {});
  const scale = prepared.scale;
  let normalized: PlanImportResult['plano'];
  let lineHints = prepared.walls;
  if (prepared.fromPixels && raw.habitaciones.length > 0) {
    const built = buildPlanFromRooms(raw.habitaciones, prepared);
    normalized = built.plano;
    lineHints = built.lineHints;
    warnings.push(...built.warnings);
  } else {
    normalized = normalizeSketchDetailed(raw, { zoneStrategy: 'rooms', ...(options.normalize ?? {}) }).plano;
  }

  // Medidas escritas por estancia: las leídas por el modelo, casadas con la
  // zona detectada por nombre, o las que el usuario corrigió en la tabla.
  const written = options.roomOverrides ?? writtenFromRaw(raw, normalized.zones);
  const expectations: RoomExpectation[] = written
    .filter((w) => !w.exterior && (w.widthMm !== undefined || w.heightMm !== undefined))
    .map((w) => ({ zoneId: w.zoneId, widthMm: w.widthMm, heightMm: w.heightMm }));
  const general = generalFromRaw(raw);
  // Con estancias del modelo, la caja leída es aproximada: las cotas escritas
  // mandan aunque la desviación sea grande (el residuo delata contradicciones).
  const fit = fitPlanToDimensions(normalized, expectations, general, {
    maxRelativeCorrection: ROOMS_MAX_RELATIVE_CORRECTION,
    // Los muros medidos deciden qué tramos son un mismo muro físico.
    lineHints: lineHints.map((w, i) => ({
      id: `hint${i}`,
      from: { x: Math.round(w.x1 * scale.mmPerUnitX), y: Math.round(w.y1 * scale.mmPerUnitY) },
      to: { x: Math.round(w.x2 * scale.mmPerUnitX), y: Math.round(w.y2 * scale.mmPerUnitY) },
      thicknessMm: 0,
    })),
  });
  warnings.push(...fit.warnings);
  // Tabiques reconstruidos cruzan muros: partir en cada cruce (el editor exige
  // vértice compartido). Después, ninguna abertura puede pisarse ni asomar.
  const fitted = { ...fit, plano: cleanupApertures(planarizePlano(fit.plano)) };

  const walls = fitted.plano.zones.flatMap((z) => z.walls);
  const exterior = buildExteriorZones(raw.habitaciones, scale, fitted.plano.zones, walls);
  warnings.push(...exterior.warnings);

  let furniture: PlanImportResult['furniture'] = [];
  if (options.includeFurniture !== false && raw.mobiliario?.length) {
    const zones = [
      ...fitted.plano.zones,
      // Las zonas exteriores nuevas también albergan mobiliario (mesa de terraza).
      ...exterior.exteriors
        .filter((e) => !fitted.plano.zones.some((z) => z.id === e.id))
        .map((e) => ({ id: e.id, name: e.name, outline: e.outline, walls: [], apertures: [], dimensions: [] })),
    ];
    const placed = placeFurniture(raw.mobiliario, scale, zones);
    furniture = placed.furniture;
    warnings.push(...placed.warnings);
  }

  return {
    plano: fitted.plano,
    escalaEstimada: raw.escalaFiable !== true && general === undefined,
    writtenDimensions: written,
    corrections: fitted.corrections,
    exteriors: exterior.exteriors,
    furniture,
    warnings,
  };
}

/** El ancho confirmado sustituye a las cotas generales leídas: escala fiable a partir de él. */
function withConfirmedWidth(raw: RawSketch, widthMm: number | undefined): RawSketch {
  if (widthMm === undefined || !Number.isFinite(widthMm) || widthMm <= 0) return raw;
  const next: RawSketch = { ...raw, anchoMetros: widthMm / 1000, escalaFiable: true };
  delete next.altoMetros;
  return next;
}

/** Casa cada estancia del modelo con la zona detectada que lleva su nombre y arrastra sus medidas escritas. */
function writtenFromRaw(raw: RawSketch, zones: PlanImportResult['plano']['zones']): WrittenRoomDimensions[] {
  // Dos estancias pueden llamarse igual ("Baño"): cada una casa con la primera
  // estancia del modelo aún libre con ese nombre, en orden.
  const used = new Set<number>();
  const out: WrittenRoomDimensions[] = [];
  for (const zone of zones) {
    const index = raw.habitaciones.findIndex((r, i) => r.nombre === zone.name && !used.has(i));
    const room = index >= 0 ? raw.habitaciones[index] : undefined;
    const entry: WrittenRoomDimensions = { zoneId: zone.id, name: zone.name };
    if (room) {
      used.add(index);
      if (room.exterior === true) entry.exterior = true;
      if (room.anchoMetros !== undefined) entry.widthMm = Math.round(room.anchoMetros * 1000);
      if (room.altoMetros !== undefined) entry.heightMm = Math.round(room.altoMetros * 1000);
      if (room.areaM2 !== undefined) entry.areaM2 = room.areaM2;
    }
    out.push(entry);
  }
  return out;
}

/** Cotas generales (ancho/alto del plano) solo si el modelo las leyó como fiables. */
function generalFromRaw(raw: RawSketch): { widthMm?: number; heightMm?: number } | undefined {
  if (raw.escalaFiable !== true) return undefined;
  const general: { widthMm?: number; heightMm?: number } = {};
  if (raw.anchoMetros !== undefined) general.widthMm = Math.round(raw.anchoMetros * 1000);
  if (raw.altoMetros !== undefined) general.heightMm = Math.round(raw.altoMetros * 1000);
  return general.widthMm === undefined && general.heightMm === undefined ? undefined : general;
}
