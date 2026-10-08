/**
 * Orquestación PURA de la importación de un plano dibujado: extracción cruda
 * (modelo + raster) → normalización → ajuste a cotas escritas → zonas
 * exteriores → mobiliario. Devuelve el `PlanImportResult` que la UI muestra en
 * la tabla de estancias y que, tras corregir el usuario, se materializa en el
 * editor. Sin red ni BD: testeable con fixtures.
 */
import type { PlanDoorOverride, PlanWallOverride, PlanZoneOutlineOverride, PlanImportResult, PlanImportWarning, WrittenRoomDimensions } from '@/lib/contracts';
import { applyReviewedDoors, applyReviewedOutlines, applyReviewedWalls } from '@/lib/plan-review-geometry';
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
import { inferMissingRooms } from '@/server/ai/sketch/infer-missing-rooms';
import { markGarageDoors } from '@/server/ai/sketch/garage-apertures';

export interface BuildPlanImportOptions {
  normalize?: Partial<NormalizeOptions>;
  /** Medidas corregidas por el usuario en la tabla (prevalecen sobre las leídas). */
  roomOverrides?: WrittenRoomDimensions[];
  /** Correcciones de giro/bisagra confirmadas sobre la vista revisada. */
  doorOverrides?: PlanDoorOverride[];
  wallOverrides?: PlanWallOverride[];
  zoneOutlineOverrides?: PlanZoneOutlineOverride[];
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
// Una cota leída por visión no puede arrastrar muros detectados en la imagen
// más de unos píxeles: la posición observada manda hasta revisión manual.
const MAX_RASTER_FIT_SHIFT_MM = 150;

export function buildPlanImport(rawIn: RawSketch, options: BuildPlanImportOptions = {}): PlanImportResult {
  const read = normalizeEnclosedRooms(withConfirmedWidth(rawIn, options.generalWidthMm));
  const warnings: PlanImportWarning[] = [];
  // Con muros medidos y estancias leídas, las estancias SON el plano
  // (reconstrucción cerrada por construcción); si falta alguna de las dos
  // fuentes, se cae a la normalización clásica por regiones.
  let prepared = prepareSketch(read, options.normalize ?? {});
  // El hueco ancho en la fachada de la cochera es la puerta del coche: se marca
  // con la escala ya medida y se prepara de nuevo para no recortar su ancho.
  const raw = markGarageDoors(read, prepared.scale);
  if (raw !== read) prepared = prepareSketch(raw, options.normalize ?? {});
  const scale = prepared.scale;
  const generalMismatch = generalDimensionsMismatch(raw, scale);
  if (generalMismatch) warnings.push(generalMismatch);
  let normalized: PlanImportResult['plano'];
  let lineHints = prepared.walls;
  if (prepared.fromPixels && raw.habitaciones.length > 0) {
    const regions = normalizeSketchDetailed(raw, { zoneStrategy: 'regions', ...(options.normalize ?? {}) });
    const recovered = inferMissingRooms(raw.habitaciones, regions.plano.zones, scale);
    if (recovered.length) warnings.push({
      code: 'estancia-inferida',
      message: `Se encontraron ${recovered.length} espacio(s) grandes sin nombre en la lectura. Comprueba sus límites y asígnales una estancia en el editor.`,
    });
    const built = buildPlanFromRooms([...raw.habitaciones, ...recovered], prepared);
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
    inferRoomReference: prepared.fromPixels,
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
  const shiftMm = maxWallDisplacementMm(normalized, fit.plano);
  const keepMeasuredWalls = prepared.fromPixels && shiftMm > MAX_RASTER_FIT_SHIFT_MM;
  if (keepMeasuredWalls) warnings.push({
    code: 'ajuste-desplaza-muros',
    message: `Las cotas leídas moverían muros hasta ${(shiftMm / 1000).toFixed(2).replace('.', ',')} m respecto al dibujo. Se conservan los muros de la imagen; revisa esas medidas antes de generar.`,
  });
  else if (shiftMm >= 500) warnings.push({
    code: 'ajuste-desplaza-muros',
    message: `El ajuste de cotas desplazó muros hasta ${(shiftMm / 1000).toFixed(2).replace('.', ',')} m respecto al dibujo. Comprueba la superposición antes de aceptar el plano.`,
  });
  // Tabiques reconstruidos cruzan muros: partir en cada cruce (el editor exige
  // vértice compartido). Después, ninguna abertura puede pisarse ni asomar.
  const fitted = {
    ...fit,
    corrections: keepMeasuredWalls ? [] : fit.corrections,
    plano: applyReviewedOutlines(applyReviewedDoors(applyReviewedWalls(cleanupApertures(planarizePlano(keepMeasuredWalls ? normalized : fit.plano)), options.wallOverrides), options.doorOverrides), options.zoneOutlineOverrides),
  };

  const interiorRooms = raw.habitaciones.filter((room) => room.exterior !== true).length;
  const confirmedDoors = fitted.plano.zones.flatMap((zone) => zone.apertures)
    .filter((aperture) => aperture.kind === 'puerta').length;
  if (prepared.fromPixels && interiorRooms >= 8 && confirmedDoors < Math.ceil(interiorRooms / 2)) {
    warnings.push({
      code: 'arcos-insuficientes',
      message: `Solo se reconocieron ${confirmedDoors} puerta(s) para ${interiorRooms} estancias interiores. Comprueba las puertas ausentes y sus arcos sobre el original antes de generar.`,
    });
  }

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
    sourceFrameMm: { width: scale.mmPerUnitX, height: scale.mmPerUnitY },
    escalaEstimada: raw.escalaFiable !== true && general === undefined,
    writtenDimensions: written,
    corrections: fitted.corrections,
    exteriors: exterior.exteriors,
    furniture,
    warnings,
  };
}

function maxWallDisplacementMm(before: PlanImportResult['plano'], after: PlanImportResult['plano']): number {
  const original = new Map(before.zones.flatMap((zone) => zone.walls).map((wall) => [wall.id, wall]));
  let max = 0;
  for (const wall of after.zones.flatMap((zone) => zone.walls)) {
    const prior = original.get(wall.id);
    if (!prior) continue;
    max = Math.max(max,
      Math.hypot(wall.from.x - prior.from.x, wall.from.y - prior.from.y),
      Math.hypot(wall.to.x - prior.to.x, wall.to.y - prior.to.y));
  }
  return max;
}

/** Una cochera cerrada pertenece al edificio aunque la visión la marque exterior. */
function normalizeEnclosedRooms(raw: RawSketch): RawSketch {
  return {
    ...raw,
    habitaciones: raw.habitaciones.map((room) =>
      room.exterior === true && /^(cochera|garaje|garage)(?:\s+\d+)?$/i.test(room.nombre.trim())
        ? { ...room, exterior: false }
        : room),
  };
}

function generalDimensionsMismatch(raw: RawSketch, scale: { mmPerUnitX: number; mmPerUnitY: number }): PlanImportWarning | undefined {
  if (raw.escalaFiable !== true || raw.anchoMetros === undefined || raw.altoMetros === undefined) return;
  const widthMm = raw.anchoMetros * 1000, heightMm = raw.altoMetros * 1000;
  if (widthMm <= 0 || heightMm <= 0) return;
  const candidates = [raw.habitaciones, raw.habitaciones.filter((room) => !room.exterior)]
    .map((rooms) => rooms.flatMap((room) => room.poligono))
    .filter((points) => points.length >= 4)
    .map((points) => {
      const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
      const drawnWidthMm = (Math.max(...xs) - Math.min(...xs)) * scale.mmPerUnitX;
      const drawnHeightMm = (Math.max(...ys) - Math.min(...ys)) * scale.mmPerUnitY;
      const error = Math.max(Math.abs(drawnWidthMm - widthMm) / widthMm, Math.abs(drawnHeightMm - heightMm) / heightMm);
      return { drawnWidthMm, drawnHeightMm, error };
    });
  const best = candidates.sort((a, b) => a.error - b.error)[0];
  if (!best || best.error <= 0.05) return;
  const metres = (mm: number) => (mm / 1000).toFixed(2).replace('.', ',');
  return {
    code: 'cotas-generales-discordantes',
    message: `Las dimensiones globales extraídas de la imagen son ${metres(widthMm)} × ${metres(heightMm)} m, pero el perímetro leído mide ${metres(best.drawnWidthMm)} × ${metres(best.drawnHeightMm)} m. Son datos de la extracción, no cotas verificadas por el usuario. Comprueba la escala y los límites antes de generar.`,
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
