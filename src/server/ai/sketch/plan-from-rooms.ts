/**
 * Reconstrucción del plano DESDE LAS ESTANCIAS (planos dibujados).
 *
 * En un plano dibujado el modelo de visión sitúa bien cada estancia (polígono
 * + nombre + medidas escritas). Aquí las estancias SON el plano: cada polígono
 * se posa sobre una rejilla global de líneas (una por coordenada compartida
 * entre estancias, afinada con los muros medidos por píxeles) y los muros son
 * las aristas de esos polígonos. Por construcción el resultado es un complejo
 * cerrado y consistente: no hay muros sueltos, ni tabiques que no llegan, ni
 * bordes de terraza convertidos en muro. El raster sólo aporta la posición
 * exacta de las líneas, los huecos (aberturas) y el grosor por clase; el
 * modelo aporta la topología. Puro y sin IA.
 */
import type {
  PlanAperture,
  PlanImportWarning,
  PlanPoint,
  PlanWall,
  PlanZone,
  Plano2dPayload,
} from '@/lib/contracts';
import type { SketchPoint, SketchRoom, SketchWall } from './sketch-types';
import {
  anchorApertures,
  seedsFromGaps,
  type ApertureSeed,
  type PreparedSketch,
  type Scale,
} from './normalize-geometry';
import { assignMeasuredThickness, classifyWallThickness } from './wall-thickness';
import { mergeOpenPlanRooms, roomOverlapWarnings } from './room-overlap';
import { leafWithoutArc, recognizedLeafType } from './aperture-types';

export interface RoomsPlan {
  plano: Plano2dPayload;
  warnings: PlanImportWarning[];
  /**
   * Muros medidos partidos donde atraviesan un vacío INTERIOR (pasillo sin
   * estancia leída): sirven al solver de cotas para decidir qué tramos
   * colineales son el mismo muro físico. Un retranqueo de fachada une tramos;
   * un pasillo entre dos filas de estancias no (sus cotas pueden discrepar).
   */
  lineHints: SketchWall[];
  /** Diagnóstico: rejilla y polígonos posados (unidades de imagen). */
  debug: {
    gridX: GridLine[];
    gridY: GridLine[];
    polygons: Array<{ name: string; points: SketchPoint[] }>;
  };
}

// Si la caja del polígono leído supera la medida escrita en más de esto, el
// modelo anexó a la estancia un trozo de otra (pasillo, armario): se toma el
// mayor rectángulo inscrito en el polígono.
const MAX_BOX_OVER_COTA = 0.12;

type Axis = 'x' | 'y';

// Vértices de estancia a menos de esto (unidades de imagen) comparten línea.
const CLUSTER_TOL = 0.012;
// Una línea de estancias se posa sobre un muro medido a menos de esto.
const SNAP_WINDOW = 0.015;
// Lado mínimo de una estancia creíble (unidades de imagen).
const MIN_SIDE = 0.02;
// Desplazamiento (unidades de imagen) para sondear a qué lado de un muro hay estancia.
const PROBE = 0.004;
const MIN_UNSUPPORTED_LENGTH = 0.15;
const MIN_MEASURED_COVERAGE = 0.35;
const MIN_PERIMETER_COVERAGE = 0.6;
const MEASURED_LINE_TOLERANCE = 0.02;

interface Poly {
  room: SketchRoom;
  /** Polígono completo posado en la rejilla: define los muros. */
  points: SketchPoint[];
  /** Cuerpo de la estancia para medir (rectángulo principal si el modelo le anexó un trozo ajeno). */
  body: SketchPoint[];
}

/** Segmento elemental de muro sobre una línea de la rejilla. */
interface Segment {
  axis: Axis;
  value: number;
  lo: number;
  hi: number;
  /** Índices (en `polys`) de las estancias con una arista sobre este tramo. */
  owners: number[];
  exterior: boolean;
  thicknessMm: number;
  /** Vano que ocupa casi todo el tramo, con arco observado y jambas medidas. */
  arcBacked?: boolean;
}

/** Reconstruye muros, aberturas y zonas a partir de las estancias del modelo. */
export function buildPlanFromRooms(rooms: SketchRoom[], prepared: PreparedSketch): RoomsPlan {
  const { opts, scale } = prepared;
  const warnings: PlanImportWarning[] = [];

  // La banda original fija la posición, pero la limpieza puede revelar que dos
  // caras cercanas son el mismo cerramiento y deben compartir un único eje.
  const gridX = topologyGrid(rooms, prepared, 'x');
  const gridY = topologyGrid(rooms, prepared, 'y');

  let polys: Poly[] = [];
  for (const room of rooms) {
    const points = snapPolygon(room.poligono, gridX, gridY);
    if (points === null) {
      warnings.push({
        code: 'zona-exterior-sin-contorno',
        message: `«${room.nombre}»: el contorno leído es demasiado pequeño o degenerado; no se reconstruye.`,
      });
      continue;
    }
    const body = snapPolygon(trimToWrittenSize(room, scale), gridX, gridY) ?? points;
    polys.push({ room, points, body });
  }
  const merged = mergeOpenPlanRooms(polys, prepared.sourceWalls);
  polys = merged.shapes.map(({ room, points, body }) => ({
    room,
    points: dropRedundant(points),
    body: dropRedundant(body ?? points),
  }));
  warnings.push(...merged.warnings, ...roomOverlapWarnings(polys));

  const edges = splitAtSupportEnds(elementarySegments(polys), prepared, polys);
  const segments = [...edges, ...supportedInteriorModelSegments(prepared, polys, edges)];
  classifySegments(segments, polys, prepared, scale);

  const hasInteriorOwner = (segment: Segment) => segment.owners.some((i) => polys[i]!.room.exterior !== true);
  const measuredSegments = segments.filter((segment) => {
    // El contorno de un jardín o terraza sigue siendo un límite lógico: un
    // trazo fino de parcela no demuestra que haya un muro físico exterior.
    if (!hasInteriorOwner(segment)) {
      // El cerramiento exterior de un jardín dibujado también es un muro
      // cuando coinciden el trazo grueso medido y la línea estructural leída.
      return prepared.fromPixels &&
        pairedMeasuredLine(segment, prepared.sourceWalls) &&
        measuredCoverage(segment.axis, segment.value, segment.lo, segment.hi,
          prepared.modelWalls, 0) >= MIN_PERIMETER_COVERAGE;
    }
    const hasExteriorOwner = segment.owners.some((i) => polys[i]!.room.exterior === true);
    if (!prepared.fromPixels) return true;
    if (hasExteriorOwner) {
      // Una división lógica entre jardín e interior no se convierte en muro
      // solo porque visión la dibuje. El trazo debe existir en la imagen.
      return measuredCoverage(segment.axis, segment.value, segment.lo, segment.hi,
        prepared.sourceWalls, 0.0025) >= MIN_PERIMETER_COVERAGE ||
        arcSupportedSegment(segment, prepared);
    }
    const measured = measuredCoverage(segment.axis, segment.value, segment.lo, segment.hi, prepared.sourceWalls);
    return segment.exterior || segment.arcBacked === true ||
      measured >= (segment.hi - segment.lo < MIN_UNSUPPORTED_LENGTH ? 0.2 : MIN_MEASURED_COVERAGE) ||
      arcSupportedSegment(segment, prepared) ||
      (measuredCoverage(segment.axis, segment.value, segment.lo, segment.hi,
        prepared.modelWalls, 0) >= MIN_PERIMETER_COVERAGE &&
        measuredCoverage(segment.axis, segment.value, segment.lo, segment.hi,
          prepared.sourceWalls, 0.0025) >= MIN_PERIMETER_COVERAGE);
  });
  const touches = (point: SketchPoint, segment: Segment) => segment.axis === 'x'
    ? Math.abs(point.x - segment.value) <= 0.015 && point.y >= segment.lo - 0.015 && point.y <= segment.hi + 0.015
    : Math.abs(point.y - segment.value) <= 0.015 && point.x >= segment.lo - 0.015 && point.x <= segment.hi + 0.015;
  const modelOnly = segments.filter((segment) => {
    if (measuredSegments.includes(segment) || !hasInteriorOwner(segment)) return false;
    // Si el límite jardín/interior no tiene trazo medido, la continuidad en
    // las esquinas no convierte una división lógica del modelo en pared.
    if (segment.owners.some((owner) => polys[owner]!.room.exterior === true)) return false;
    if (measuredCoverage(segment.axis, segment.value, segment.lo, segment.hi,
      prepared.modelWalls, 0) < 0.8) return false;
    const ends = segment.axis === 'x'
      ? [{ x: segment.value, y: segment.lo }, { x: segment.value, y: segment.hi }]
      : [{ x: segment.lo, y: segment.value }, { x: segment.hi, y: segment.value }];
    return ends.every((point) => measuredSegments.some((other) => touches(point, other)));
  });
  const selectedSegments = segments.filter((segment) => measuredSegments.includes(segment) || modelOnly.includes(segment));
  const wallSegments = selectedSegments;
  if (modelOnly.length) warnings.push({
    code: 'muro-solo-modelo',
    message: `${modelOnly.length} tramo(s) de muro se apoyan en la lectura visual y sus uniones, pero el raster no los confirmó. Compruébalos sobre el original.`,
  });
  const omitted = segments.filter(hasInteriorOwner).length - selectedSegments.filter(hasInteriorOwner).length;
  if (omitted) warnings.push({
    code: 'muro-inferido-omitido',
    message: `Se omitieron ${omitted} tramo(s) de muro inferidos de estancias sin apoyo suficiente en la imagen. Comprueba los espacios abiertos en la superposición.`,
  });
  const unitWalls: SketchWall[] = wallSegments.map((s) =>
    s.axis === 'x'
      ? { x1: s.value, y1: s.lo, x2: s.value, y2: s.hi }
      : { x1: s.lo, y1: s.value, x2: s.hi, y2: s.value },
  );
  const planWalls: PlanWall[] = wallSegments.map((s, i) => ({
    id: `w${i}`,
    from: toMm(unitWalls[i]!.x1, unitWalls[i]!.y1, scale),
    to: toMm(unitWalls[i]!.x2, unitWalls[i]!.y2, scale),
    thicknessMm: s.thicknessMm,
  }));

  // En imágenes rasterizadas, el modelo puede rescatar una puerta que el
  // detector de huecos no vio, pero sólo si el trazo medido no ocupa su ancho.
  // Una puerta sugerida sobre un muro sólido crearía un paso falso.
  const exteriorWallIds = new Set(planWalls.filter((_, i) =>
    wallSegments[i]!.exterior ||
    wallSegments[i]!.owners.some((owner) => polys[owner]!.room.exterior === true),
  ).map((w) => w.id));
  // En un plano leído, un hueco interior sin hoja reconocida es paso abierto.
  const fromGaps = prepared.fromPixels ? seedsFromGaps(prepared.gaps, prepared.seeds, prepared.walls, 'hueco')
    .map((seed) => seed.tipo === 'puerta' && !doorArcNear(seed, prepared.seeds)
      ? { ...seed, tipo: 'hueco' as const, swing: undefined, hinge: undefined } : seed) : [];
  // Un hueco detectado a varios centímetros del eje puede proceder de texto
  // o mobiliario; no se proyecta hasta un muro lejano.
  const anchoredGaps = anchorApertures(fromGaps, unitWalls, planWalls, scale, opts, 0.03);
  const anchoredModel = prepared.seeds.filter((seed) => seed.tipo !== 'puerta' || hasDoorArc(seed)).flatMap((seed) => {
    const primary = anchorApertures([seed], unitWalls, planWalls, scale, opts)[0];
    if (!primary) return [];
    const rescued = seed.tipo === 'puerta' && !seed.observedArc && prepared.fromPixels &&
      apertureCoverage(primary, unitWalls, planWalls, prepared.sourceWalls) >= 0.8
      ? rescuePerpendicularDoor(seed, unitWalls, planWalls, prepared)
      : undefined;
    return [rescued ?? primary];
  }).filter((aperture) => {
    // Cuando visión ha identificado también arco y bisagra (o una corredera,
    // plegable o doble hoja), un trazo raster continuo puede ser la hoja de la
    // puerta; no lo tratamos como veto.
    if (!prepared.fromPixels || aperture.kind === 'ventana') return true;
    const planWall = planWalls.find((wall) => wall.id === aperture.wallId);
    if (!planWall) return false;
    const lengthMm = Math.hypot(planWall.to.x - planWall.from.x, planWall.to.y - planWall.from.y);
    // Una abertura que consume casi todo un tramo corto suele ser una puerta
    // proyectada al lado equivocado de una unión en T.
    const coverageLimit = (aperture.swing && aperture.hinge || recognizedLeafType(aperture.catalogId)) &&
      aperture.widthMm < lengthMm * 0.9 ? 1.01 : 0.3;
    return apertureCoverage(aperture, unitWalls, planWalls, prepared.sourceWalls) < coverageLimit;
  });
  const apertures = mergeApertures(anchoredGaps, anchoredModel, planWalls);
  const interiorWindows = apertures.filter((a) => a.kind === 'ventana' && !exteriorWallIds.has(a.wallId)).length;
  if (interiorWindows) warnings.push({
    code: 'ventana-interior-por-revisar',
    message: `${interiorWindows} ventana(s) leídas en tabiques interiores: comprueba que son ventanas reales sobre el original.`,
  });

  // Sin cotas importadas: el editor acota en vivo y las del plano sólo estorbaban.
  const zones = buildZones(polys, wallSegments, planWalls, apertures, scale);
  return {
    plano: { schemaVersion: 1, zones },
    warnings,
    lineHints: splitAtInteriorVoids(prepared.walls, polys),
    debug: { gridX, gridY, polygons: polys.map((p) => ({ name: p.room.nombre, points: p.points })) },
  };
}

/** Puerta con hoja reconocida: arco visible o con giro y bisagra, o una corredera, plegable o doble hoja leída. */
function hasDoorArc(seed: ApertureSeed): boolean {
  return seed.tipo === 'puerta' && (seed.arcVisible === true || Boolean(seed.swing && seed.hinge) || leafWithoutArc(seed.variante));
}

function doorArcNear(candidate: ApertureSeed, seeds: ApertureSeed[]): boolean {
  return seeds.some((seed) => hasDoorArc(seed) &&
    Math.hypot(seed.center.x - candidate.center.x, seed.center.y - candidate.center.y) <= 0.08 &&
    (!seed.sourceDirection || !candidate.sourceDirection ||
      Math.abs(seed.sourceDirection.x * candidate.sourceDirection.x +
        seed.sourceDirection.y * candidate.sourceDirection.y) >= 0.9));
}

/** Un muro corto de puerta puede ser casi todo vano: exige hueco y arco próximos. */
function arcSupportedSegment(segment: Segment, prepared: PreparedSketch): boolean {
  const horizontal = segment.axis === 'y';
  const nearSegment = (point: SketchPoint) => {
    const value = horizontal ? point.y : point.x;
    const along = horizontal ? point.x : point.y;
    return Math.abs(value - segment.value) <= 0.03 && along >= segment.lo - 0.015 && along <= segment.hi + 0.015;
  };
  if (prepared.gaps.some((gap) => gap.direction && doorArcNear({
    tipo: 'hueco', center: gap.center, sourceDirection: gap.direction,
  }, prepared.seeds) &&
    (horizontal ? Math.abs(gap.direction.x) : Math.abs(gap.direction.y)) >= 0.9 && nearSegment(gap.center))) return true;
  // Dos jambas horizontales/verticales observadas cierran el tabique aunque
  // el detector no vea su tramo central, ocupado por la hoja de la puerta.
  const observed = prepared.seeds.some((seed) => seed.tipo === 'puerta' && seed.observedArc &&
    seed.sourceDirection && nearSegment(seed.center) &&
    (horizontal ? Math.abs(seed.sourceDirection.x) : Math.abs(seed.sourceDirection.y)) >= 0.9 &&
    (seed.widthUnit ?? 0) >= (segment.hi - segment.lo) * 0.35);
  if (observed && [segment.lo, segment.hi].every((end) => measuredCoverage(
    horizontal ? 'x' : 'y', end, segment.value - 0.02, segment.value + 0.02,
    prepared.sourceWalls, 0.003, 0.012,
  ) > 0.2)) return true;
  return prepared.seeds.some((seed) => hasDoorArc(seed) && nearSegment(seed.center)) &&
    measuredCoverage(segment.axis, segment.value, segment.lo, segment.hi, prepared.sourceWalls, 0.0025) >= 0.15;
}

/** Corrige una puerta situada por visión en el tabique de una unión en T. */
function rescuePerpendicularDoor(
  seed: ApertureSeed, unitWalls: SketchWall[], planWalls: PlanWall[], prepared: PreparedSketch,
): PlanAperture | undefined {
  const candidates = unitWalls.flatMap((wall, i) => {
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
    const len = Math.hypot(dx, dy);
    if (!len || !seed.sourceDirection || Math.abs((seed.sourceDirection.x * dx + seed.sourceDirection.y * dy) / len) > 0.1) return [];
    const direction = { x: dx / len, y: dy / len };
    const relX = seed.center.x - wall.x1, relY = seed.center.y - wall.y1;
    const t = (relX * direction.x + relY * direction.y) / len;
    const perp = Math.abs(relX * -direction.y + relY * direction.x);
    if (perp > 0.025 || t < -0.1 || t > 1.1) return [];
    const axis: Axis = Math.abs(dx) < Math.abs(dy) ? 'x' : 'y';
    const start = axis === 'x' ? wall.y1 : wall.x1;
    const end = axis === 'x' ? wall.y2 : wall.x2;
    const support = measuredCoverage(axis, axis === 'x' ? wall.x1 : wall.y1,
      Math.min(start, end), Math.max(start, end), prepared.sourceWalls, 0.0025);
    if (support < 0.15) return [];
    const alternate = anchorApertures([{ ...seed, sourceDirection: direction, swing: undefined, hinge: undefined }],
      unitWalls, planWalls, prepared.scale, prepared.opts, 0.025)[0];
    if (!alternate || alternate.wallId !== planWalls[i]?.id ||
      apertureCoverage(alternate, unitWalls, planWalls, prepared.sourceWalls) >= 0.3) return [];
    return [{ aperture: alternate, score: perp + Math.max(0, -t, t - 1) * len }];
  });
  return candidates.sort((a, b) => a.score - b.score)[0]?.aperture;
}

function apertureCoverage(aperture: PlanAperture, unitWalls: SketchWall[], planWalls: PlanWall[], sourceWalls: SketchWall[]): number {
  const index = planWalls.findIndex((wall) => wall.id === aperture.wallId);
  const wall = unitWalls[index], planWall = planWalls[index];
  if (!wall || !planWall) return 1;
  const axis: Axis = Math.abs(wall.x2 - wall.x1) < Math.abs(wall.y2 - wall.y1) ? 'x' : 'y';
  const start = axis === 'x' ? wall.y1 : wall.x1;
  const end = axis === 'x' ? wall.y2 : wall.x2;
  const lengthMm = Math.hypot(planWall.to.x - planWall.from.x, planWall.to.y - planWall.from.y);
  const half = Math.abs(end - start) * aperture.widthMm / Math.max(1, lengthMm) / 2;
  const center = start + (end - start) * aperture.position;
  return measuredCoverage(axis, axis === 'x' ? wall.x1 : wall.y1, center - half, center + half, sourceWalls);
}

/** Dos trazos paralelos cercanos respaldan un cerramiento; uno solo puede ser el borde de parcela. */
function pairedMeasuredLine(segment: Segment, walls: SketchWall[]): boolean {
  const coordinates = [...new Set(walls.filter((wall) => {
    const value = segment.axis === 'x' ? wall.x1 : wall.y1;
    const straight = segment.axis === 'x' ? Math.abs(wall.x1 - wall.x2) : Math.abs(wall.y1 - wall.y2);
    return straight < 0.008 && Math.abs(value - segment.value) <= MEASURED_LINE_TOLERANCE;
  }).map((wall) => segment.axis === 'x' ? wall.x1 : wall.y1))];
  const supported = coordinates.filter((value) => measuredCoverage(
    segment.axis, value, segment.lo, segment.hi, walls, 0.002, 0.002,
  ) >= MIN_PERIMETER_COVERAGE);
  return supported.some((a) => supported.some((b) => Math.abs(a - b) >= 0.005 && Math.abs(a - b) <= 0.015));
}

/** Fracción de la arista respaldada por bandas gruesas detectadas en el original. */
function measuredCoverage(
  axis: Axis, value: number, lo: number, hi: number, walls: SketchWall[],
  minimumThickness?: number, lineTolerance = MEASURED_LINE_TOLERANCE,
): number {
  const thicknesses = walls.map((wall) => wall.thickness ?? 0).sort((a, b) => a - b);
  const upperQuartile = thicknesses[Math.floor(thicknesses.length * 0.75)] ?? 0;
  const minThickness = minimumThickness ?? Math.max(0.0045, upperQuartile * 0.5);
  const spans = walls.filter((wall) => {
    if ((wall.thickness ?? 0) < minThickness) return false;
    return axis === 'x'
      ? Math.abs(wall.x1 - wall.x2) < 0.008 && Math.abs(wall.x1 - value) <= lineTolerance
      : Math.abs(wall.y1 - wall.y2) < 0.008 && Math.abs(wall.y1 - value) <= lineTolerance;
  }).map((wall): [number, number] => axis === 'x'
    ? [Math.max(lo, Math.min(wall.y1, wall.y2)), Math.min(hi, Math.max(wall.y1, wall.y2))]
    : [Math.max(lo, Math.min(wall.x1, wall.x2)), Math.min(hi, Math.max(wall.x1, wall.x2))]
  ).filter(([lo, hi]) => hi > lo).sort((a, b) => a[0] - b[0]);
  let length = 0, coveredEnd = lo;
  for (const [start, stop] of spans) {
    length += Math.max(0, stop - Math.max(coveredEnd, start));
    coveredEnd = Math.max(coveredEnd, stop);
  }
  return length / (hi - lo);
}

/**
 * Cuerpo de la estancia para MEDIR. Si tiene medidas escritas y la caja del
 * polígono las supera con claridad, el modelo le anexó un trozo ajeno (armario,
 * tramo de pasillo): el cuerpo es el mayor rectángulo inscrito. El polígono
 * completo sigue definiendo los muros, así no quedan huecos sin dueño.
 */
function trimToWrittenSize(room: SketchRoom, scale: Scale): SketchPoint[] {
  const polygon = room.poligono;
  if (polygon.length <= 4 || (room.anchoMetros === undefined && room.altoMetros === undefined)) return polygon;
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const boxW = (Math.max(...xs) - Math.min(...xs)) * scale.mmPerUnitX;
  const boxH = (Math.max(...ys) - Math.min(...ys)) * scale.mmPerUnitY;
  const overW = room.anchoMetros !== undefined && boxW > room.anchoMetros * 1000 * (1 + MAX_BOX_OVER_COTA);
  const overH = room.altoMetros !== undefined && boxH > room.altoMetros * 1000 * (1 + MAX_BOX_OVER_COTA);
  if (!overW && !overH) return polygon;
  const best = largestInscribedRectangle(polygon);
  return best ?? polygon;
}

/** Mayor rectángulo alineado con los ejes contenido en un polígono rectilíneo (rejilla de sus vértices). */
function largestInscribedRectangle(polygon: SketchPoint[]): SketchPoint[] | null {
  const xs = [...new Set(polygon.map((p) => p.x))].sort((a, b) => a - b);
  const ys = [...new Set(polygon.map((p) => p.y))].sort((a, b) => a - b);
  let best: { area: number; x0: number; x1: number; y0: number; y1: number } | null = null;
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++)
      for (let k = 0; k < ys.length; k++)
        for (let l = k + 1; l < ys.length; l++) {
          const x0 = xs[i]!, x1 = xs[j]!, y0 = ys[k]!, y1 = ys[l]!;
          const area = (x1 - x0) * (y1 - y0);
          if (best && area <= best.area) continue;
          // Todas las celdas de la rejilla dentro del candidato deben caer en el polígono.
          let inside = true;
          for (let a = i; a < j && inside; a++)
            for (let b = k; b < l && inside; b++) {
              const c = { x: (xs[a]! + xs[a + 1]!) / 2, y: (ys[b]! + ys[b + 1]!) / 2 };
              if (!pointInPolygon(c, polygon)) inside = false;
            }
          if (inside) best = { area, x0, x1, y0, y1 };
        }
  if (!best) return null;
  return [
    { x: best.x0, y: best.y0 },
    { x: best.x1, y: best.y0 },
    { x: best.x1, y: best.y1 },
    { x: best.x0, y: best.y1 },
  ];
}

// ── Rejilla global de líneas ─────────────────────────────────────────────────

interface GridLine {
  /** Coordenada final (posada sobre un muro medido si lo hay). */
  value: number;
  /** Rango de coordenadas leídas que caen en esta línea. */
  min: number;
  max: number;
}

interface MeasuredLine {
  value: number;
  lo: number;
  hi: number;
}

/**
 * Agrupa las coordenadas de todos los vértices de estancia del eje en líneas
 * (tolerancia `CLUSTER_TOL`) y posa cada una sobre el muro medido más cercano
 * cuyo recorrido solapa con los vértices que la forman.
 */
function topologyGrid(rooms: SketchRoom[], prepared: PreparedSketch, axis: Axis): GridLine[] {
  if (!prepared.fromPixels) return buildGrid(rooms, prepared.walls, axis);
  const observed = buildGrid(rooms, prepared.sourceWalls, axis);
  const cleaned = buildGrid(rooms, prepared.walls, axis);
  // Dos caras de un cerramiento pueden diferir más que CLUSTER_TOL. Si ambas
  // acaban sobre la misma línea limpia, comparten eje sin dejar una rendija.
  for (let i = 0; i < observed.length; i++) {
    const mate = cleaned.findIndex((line, j) => j !== i &&
      Math.abs(line.value - cleaned[i]!.value) < 1e-6 &&
      Math.abs(observed[j]!.value - observed[i]!.value) < 0.025);
    if (mate >= 0) observed[i]!.value = cleaned[i]!.value;
  }
  return observed;
}

function buildGrid(rooms: SketchRoom[], measuredWalls: SketchWall[], axis: Axis): GridLine[] {
  const perpAxis: Axis = axis === 'x' ? 'y' : 'x';
  const vertices = rooms
    .flatMap((r) => r.poligono)
    .map((p) => ({ coord: p[axis], perp: p[perpAxis] }))
    .sort((a, b) => a.coord - b.coord);
  const clusters: Array<{ sum: number; n: number; min: number; max: number; perpLo: number; perpHi: number }> = [];
  for (const v of vertices) {
    const last = clusters[clusters.length - 1];
    if (last && v.coord - last.sum / last.n <= CLUSTER_TOL) {
      last.sum += v.coord;
      last.n++;
      last.max = v.coord;
      last.perpLo = Math.min(last.perpLo, v.perp);
      last.perpHi = Math.max(last.perpHi, v.perp);
    } else {
      clusters.push({ sum: v.coord, n: 1, min: v.coord, max: v.coord, perpLo: v.perp, perpHi: v.perp });
    }
  }
  const measured = measuredLines(measuredWalls, axis);
  return clusters.map((c) => {
    const mean = c.sum / c.n;
    let best: MeasuredLine | null = null;
    for (const line of measured) {
      const dist = Math.abs(line.value - mean);
      if (dist > SNAP_WINDOW) continue;
      if (Math.min(line.hi, c.perpHi) - Math.max(line.lo, c.perpLo) < -SNAP_WINDOW) continue;
      if (!best || dist < Math.abs(best.value - mean)) best = line;
    }
    return { value: best?.value ?? mean, min: c.min, max: c.max };
  });
}

function measuredLines(walls: SketchWall[], axis: Axis): MeasuredLine[] {
  return walls
    .filter((w) => (axis === 'x' ? Math.abs(w.x1 - w.x2) < 1e-6 : Math.abs(w.y1 - w.y2) < 1e-6))
    .map((w) =>
      axis === 'x'
        ? { value: w.x1, lo: Math.min(w.y1, w.y2), hi: Math.max(w.y1, w.y2) }
        : { value: w.y1, lo: Math.min(w.x1, w.x2), hi: Math.max(w.x1, w.x2) },
    );
}

function snapCoord(grid: GridLine[], v: number): number {
  const inside = grid.find((g) => v >= g.min - 1e-9 && v <= g.max + 1e-9);
  if (inside) return inside.value;
  let best = grid[0]!;
  for (const g of grid) if (Math.abs(g.value - v) < Math.abs(best.value - v)) best = g;
  return best.value;
}

/**
 * Polígono posado en la rejilla, rectilíneo y sin puntos redundantes. Null si
 * queda degenerado (dos vértices en la misma línea lo aplastan).
 */
function snapPolygon(polygon: SketchPoint[], gridX: GridLine[], gridY: GridLine[]): SketchPoint[] | null {
  if (polygon.length < 3 || gridX.length === 0 || gridY.length === 0) return null;
  const snapped = polygon.map((p) => ({ x: snapCoord(gridX, p.x), y: snapCoord(gridY, p.y) }));
  // Aristas diagonales (el modelo no cerró bien una esquina): se convierten en L.
  const rectilinear: SketchPoint[] = [];
  snapped.forEach((p, i) => {
    const prev = rectilinear[rectilinear.length - 1] ?? snapped[(i + snapped.length - 1) % snapped.length]!;
    if (prev.x !== p.x && prev.y !== p.y) rectilinear.push({ x: p.x, y: prev.y });
    rectilinear.push(p);
  });
  const cleaned = dropRedundant(rectilinear);
  if (cleaned.length < 4) return null;
  const xs = cleaned.map((p) => p.x);
  const ys = cleaned.map((p) => p.y);
  if (Math.max(...xs) - Math.min(...xs) < MIN_SIDE || Math.max(...ys) - Math.min(...ys) < MIN_SIDE) return null;
  return cleaned;
}

/** Quita duplicados consecutivos y vértices colineales (incluido el cierre). */
function dropRedundant(points: SketchPoint[]): SketchPoint[] {
  let out = points.filter((p, i, arr) => {
    const prev = arr[(i + arr.length - 1) % arr.length]!;
    return !(prev.x === p.x && prev.y === p.y);
  });
  for (let pass = 0; pass < 2; pass++) {
    out = out.filter((p, i, arr) => {
      const prev = arr[(i + arr.length - 1) % arr.length]!;
      const next = arr[(i + 1) % arr.length]!;
      const collinear = (prev.x === p.x && p.x === next.x) || (prev.y === p.y && p.y === next.y);
      return !collinear;
    });
  }
  return out;
}

// ── Segmentos elementales ────────────────────────────────────────────────────

interface Edge {
  axis: Axis;
  value: number;
  lo: number;
  hi: number;
  owner: number;
}

/**
 * Parte cada arista de estancia en los puntos donde otra estancia tiene un
 * vértice sobre la misma línea (uniones en T) y funde los tramos idénticos de
 * estancias vecinas en un solo segmento con varios dueños.
 */
function elementarySegments(polys: Poly[]): Segment[] {
  const edges: Edge[] = [];
  polys.forEach((poly, owner) => {
    poly.points.forEach((a, i) => {
      const b = poly.points[(i + 1) % poly.points.length]!;
      if (a.x === b.x && a.y !== b.y) edges.push({ axis: 'x', value: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y), owner });
      else if (a.y === b.y && a.x !== b.x) edges.push({ axis: 'y', value: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x), owner });
    });
  });
  // Puntos de corte por línea: todo vértice de cualquier estancia sobre ella.
  const cutsByLine = new Map<string, Set<number>>();
  const key = (axis: Axis, value: number) => `${axis}:${value}`;
  for (const poly of polys) {
    for (const p of poly.points) {
      for (const [axis, value, perp] of [['x', p.x, p.y], ['y', p.y, p.x]] as Array<[Axis, number, number]>) {
        const k = key(axis, value);
        if (!cutsByLine.has(k)) cutsByLine.set(k, new Set());
        cutsByLine.get(k)!.add(perp);
      }
    }
  }
  const segments = new Map<string, Segment>();
  for (const edge of edges) {
    const cuts = [...(cutsByLine.get(key(edge.axis, edge.value)) ?? [])]
      .filter((c) => c > edge.lo && c < edge.hi)
      .sort((a, b) => a - b);
    const stops = [edge.lo, ...cuts, edge.hi];
    for (let i = 0; i < stops.length - 1; i++) {
      const lo = stops[i]!;
      const hi = stops[i + 1]!;
      if (hi - lo < 1e-9) continue;
      const k = `${edge.axis}:${edge.value}:${lo}:${hi}`;
      const existing = segments.get(k);
      if (existing) existing.owners.push(edge.owner);
      else segments.set(k, { axis: edge.axis, value: edge.value, lo, hi, owners: [edge.owner], exterior: false, thicknessMm: 0 });
    }
  }
  return [...segments.values()];
}

/** Una arista larga de estancia puede cubrir solo parte de un muro dibujado. */
function splitAtSupportEnds(segments: Segment[], prepared: PreparedSketch, polys: Poly[]): Segment[] {
  const support = prepared.modelWalls;
  return segments.flatMap((segment) => {
    if (segment.owners.length !== 2 || segment.owners.some((owner) => polys[owner]!.room.exterior)) return [segment];
    const cuts = [segment.lo, segment.hi];
    for (const wall of support) {
      const vertical = Math.abs(wall.x1 - wall.x2) < 0.008;
      const horizontal = Math.abs(wall.y1 - wall.y2) < 0.008;
      if (segment.axis === 'x' ? !vertical || Math.abs(wall.x1 - segment.value) > 0.012
        : !horizontal || Math.abs(wall.y1 - segment.value) > 0.012) continue;
      const start = segment.axis === 'x' ? Math.min(wall.y1, wall.y2) : Math.min(wall.x1, wall.x2);
      const end = segment.axis === 'x' ? Math.max(wall.y1, wall.y2) : Math.max(wall.x1, wall.x2);
      if (end - start < 0.04 || end <= segment.lo || start >= segment.hi) continue;
      for (const cut of [start, end]) {
        if (cut <= segment.lo + 0.008 || cut >= segment.hi - 0.008) continue;
        const left = measuredCoverage(segment.axis, segment.value, segment.lo, cut, prepared.sourceWalls);
        const right = measuredCoverage(segment.axis, segment.value, cut, segment.hi, prepared.sourceWalls);
        if (Math.min(left, right) < 0.2 && Math.max(left, right) > 0.55) cuts.push(cut);
      }
    }
    cuts.sort((a, b) => a - b);
    const distinct = cuts.filter((cut, index) => index === 0 || cut - cuts[index - 1]! > 0.005);
    return distinct.slice(1).map((hi, index) => ({
      ...segment, lo: distinct[index]!, hi,
    })).filter((part) => part.hi - part.lo > 0.005);
  });
}

/** Conserva tabiques dentro de una estancia cuando el original confirma su trazo. */
function supportedInteriorModelSegments(prepared: PreparedSketch, polys: Poly[], edges: Segment[]): Segment[] {
  if (!prepared.fromPixels) return [];
  const candidates = prepared.modelWalls.flatMap((wall): Segment[] => {
    const vertical = Math.abs(wall.x1 - wall.x2) < 0.008;
    const horizontal = Math.abs(wall.y1 - wall.y2) < 0.008;
    if (vertical === horizontal) return [];
    const axis: Axis = vertical ? 'x' : 'y';
    const value = vertical ? (wall.x1 + wall.x2) / 2 : (wall.y1 + wall.y2) / 2;
    const lo = vertical ? Math.min(wall.y1, wall.y2) : Math.min(wall.x1, wall.x2);
    const hi = vertical ? Math.max(wall.y1, wall.y2) : Math.max(wall.x1, wall.x2);
    if (hi - lo < 0.04) return [];
    const midpoint = vertical ? { x: value, y: (lo + hi) / 2 } : { x: (lo + hi) / 2, y: value };
    const sides = vertical
      ? [{ x: midpoint.x - 0.012, y: midpoint.y }, { x: midpoint.x + 0.012, y: midpoint.y }]
      : [{ x: midpoint.x, y: midpoint.y - 0.012 }, { x: midpoint.x, y: midpoint.y + 0.012 }];
    const owner = polys.findIndex((poly) => poly.room.exterior !== true &&
      sides.every((point) => pointInPolygon(point, poly.points)));
    if (owner < 0 || edges.some((edge) => edge.axis === axis &&
      Math.abs(edge.value - value) < 0.012 &&
      Math.min(edge.hi, hi) - Math.max(edge.lo, lo) > (hi - lo) * 0.5 &&
      measuredCoverage(edge.axis, edge.value, Math.max(edge.lo, lo), Math.min(edge.hi, hi),
        prepared.sourceWalls, 0.003, 0.008) > 0.55)) return [];
    const lines = prepared.sourceWalls.filter((source) =>
      (source.thickness ?? 0) >= 0.003 &&
      (axis === 'x' ? Math.abs(source.x1 - source.x2) < 0.008 : Math.abs(source.y1 - source.y2) < 0.008) &&
      Math.abs((axis === 'x' ? source.x1 : source.y1) - value) < 0.008);
    const supported = lines.map((line) => {
      const measuredValue = axis === 'x' ? line.x1 : line.y1;
      return { value: measuredValue, coverage: measuredCoverage(
        axis, measuredValue, lo, hi, prepared.sourceWalls, 0.003, 0.002,
      ) };
    }).sort((a, b) => b.coverage - a.coverage || Math.abs(a.value - value) - Math.abs(b.value - value))[0];
    const arcBacked = prepared.seeds.find((seed) => seed.tipo === 'puerta' && seed.observedArc &&
      seed.sourceDirection &&
      (axis === 'x' ? Math.abs(seed.sourceDirection.y) : Math.abs(seed.sourceDirection.x)) > 0.85 &&
      Math.abs((axis === 'x' ? seed.center.x : seed.center.y) - value) < 0.012 &&
      (axis === 'x' ? seed.center.y : seed.center.x) >= lo - 0.012 &&
      (axis === 'x' ? seed.center.y : seed.center.x) <= hi + 0.012 &&
      (seed.widthUnit ?? 0) >= (hi - lo) * 0.55 &&
      ([lo, hi].every((end) => measuredCoverage(axis === 'x' ? 'y' : 'x', end,
        value - 0.02, value + 0.02, prepared.sourceWalls, 0.003, 0.012) > 0.2) ||
        // En planos a mano, la hoja dibujada puede ser la única línea continua
        // del vano; la línea fina observada también respalda el eje del muro.
        measuredCoverage(axis, value, lo, hi, prepared.sourceWalls, 0.001, 0.008) > 0.55));
    return (supported && supported.coverage >= 0.55) || arcBacked
      ? [{ axis, value: supported?.value ?? (arcBacked ? axis === 'x' ? arcBacked.center.x : arcBacked.center.y : value),
        lo, hi, owners: [owner], exterior: false, thicknessMm: 0,
        arcBacked: Boolean(arcBacked) }]
      : [];
  });
  const all = [...edges, ...candidates];
  return candidates.map((candidate) => {
    const crossing = all.filter((other) => other.axis !== candidate.axis &&
      other.lo - 0.02 <= candidate.value && other.hi + 0.02 >= candidate.value);
    const snap = (end: number) => crossing
      .filter((other) => Math.abs(other.value - end) < 0.02)
      .sort((a, b) => Math.abs(a.value - end) - Math.abs(b.value - end))[0]?.value ?? end;
    return { ...candidate, lo: snap(candidate.lo), hi: snap(candidate.hi) };
  });
}

/**
 * Fachada o tabique. Manda el grosor MEDIDO cuando una banda del raster cae
 * sobre el tramo; sin medida, es fachada si a un lado no hay estancia interior
 * y ese lado queda fuera de la caja de las estancias interiores (un hueco
 * interior sin estancia leída —pasillo— sigue siendo tabique).
 */
function classifySegments(segments: Segment[], polys: Poly[], prepared: PreparedSketch, scale: Scale): void {
  const interior = polys.filter((p) => p.room.exterior !== true);
  const xs = interior.flatMap((p) => p.points.map((q) => q.x));
  const ys = interior.flatMap((p) => p.points.map((q) => q.y));
  const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const insideInterior = (p: SketchPoint) => interior.some((poly) => pointInPolygon(p, poly.points));
  const insideBox = (p: SketchPoint) =>
    p.x > box.minX + PROBE / 2 && p.x < box.maxX - PROBE / 2 && p.y > box.minY + PROBE / 2 && p.y < box.maxY - PROBE / 2;

  const { thin, thick } = thicknessClasses(prepared, scale);
  const unitWalls: SketchWall[] = segments.map((s) =>
    s.axis === 'x' ? { x1: s.value, y1: s.lo, x2: s.value, y2: s.hi } : { x1: s.lo, y1: s.value, x2: s.hi, y2: s.value },
  );
  const measured = prepared.fromPixels
    ? assignMeasuredThickness(unitWalls, prepared.sourceWalls, prepared.opts.snapDistance, prepared.opts.angleToleranceDeg)
    : unitWalls;

  segments.forEach((s, i) => {
    const mid = s.axis === 'x' ? { x: s.value, y: (s.lo + s.hi) / 2 } : { x: (s.lo + s.hi) / 2, y: s.value };
    const sideA = s.axis === 'x' ? { x: mid.x - PROBE, y: mid.y } : { x: mid.x, y: mid.y - PROBE };
    const sideB = s.axis === 'x' ? { x: mid.x + PROBE, y: mid.y } : { x: mid.x, y: mid.y + PROBE };
    const open = [sideA, sideB].filter((p) => !insideInterior(p));
    s.exterior = open.some((p) => !insideBox(p));
    const t = measured[i]!.thickness;
    if (t !== undefined && thick !== thin) {
      const mmPerUnit = s.axis === 'x' ? scale.mmPerUnitX : scale.mmPerUnitY;
      const mm = t * mmPerUnit;
      s.thicknessMm = Math.abs(mm - thick) < Math.abs(mm - thin) ? thick : thin;
    } else {
      s.thicknessMm = s.exterior ? thick : thin;
    }
  });
}

/**
 * Vacío interior: punto fuera de toda estancia interior (a ambos lados del
 * muro) y ENCERRADO por estancias, es decir, sin salida recta al exterior en
 * ninguna de las cuatro direcciones (un pasillo sin estancia leída). Un
 * retranqueo de fachada tiene salida y no cuenta.
 */
function interiorVoidTester(polys: Poly[]): (p: SketchPoint, axis: Axis) => boolean {
  const interior = polys.filter((p) => p.room.exterior !== true);
  const xs = interior.flatMap((p) => p.points.map((q) => q.x));
  const ys = interior.flatMap((p) => p.points.map((q) => q.y));
  const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const insideInterior = (p: SketchPoint) => interior.some((poly) => pointInPolygon(p, poly.points));
  const step = PROBE * 2;
  const enclosed = (p: SketchPoint) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      let blocked = false;
      for (let q = { x: p.x + dx * step, y: p.y + dy * step }; q.x >= box.minX && q.x <= box.maxX && q.y >= box.minY && q.y <= box.maxY; q = { x: q.x + dx * step, y: q.y + dy * step }) {
        if (insideInterior(q)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return false;
    }
    return true;
  };
  return (p, axis) => {
    const a = axis === 'x' ? { x: p.x - PROBE, y: p.y } : { x: p.x, y: p.y - PROBE };
    const b = axis === 'x' ? { x: p.x + PROBE, y: p.y } : { x: p.x, y: p.y + PROBE };
    if (insideInterior(a) || insideInterior(b)) return false;
    return enclosed(a) && enclosed(b);
  };
}

/** Parte cada muro medido en los tramos que NO atraviesan un vacío interior. */
function splitAtInteriorVoids(walls: SketchWall[], polys: Poly[]): SketchWall[] {
  const isVoid = interiorVoidTester(polys);
  const out: SketchWall[] = [];
  const step = PROBE * 2;
  for (const w of walls) {
    const axis: Axis | null = Math.abs(w.x1 - w.x2) < 1e-6 ? 'x' : Math.abs(w.y1 - w.y2) < 1e-6 ? 'y' : null;
    if (axis === null) continue;
    const value = axis === 'x' ? w.x1 : w.y1;
    const lo = axis === 'x' ? Math.min(w.y1, w.y2) : Math.min(w.x1, w.x2);
    const hi = axis === 'x' ? Math.max(w.y1, w.y2) : Math.max(w.x1, w.x2);
    // Muestras a paso fijo más el extremo final: un tramo sin vacío sale entero.
    const samples: number[] = [];
    for (let t = lo; t < hi; t += step) samples.push(t);
    samples.push(hi);
    let runStart: number | null = null;
    samples.forEach((at, index) => {
      const p = axis === 'x' ? { x: value, y: at } : { x: at, y: value };
      const voidHere = isVoid(p, axis);
      if (!voidHere && runStart === null) runStart = at;
      const last = index === samples.length - 1;
      if ((voidHere || last) && runStart !== null) {
        const end = voidHere ? at - step : hi;
        if (end - runStart >= MIN_SIDE) {
          out.push(axis === 'x' ? { x1: value, y1: runStart, x2: value, y2: end } : { x1: runStart, y1: value, x2: end, y2: value });
        }
        runStart = null;
      }
    });
  }
  return out;
}

// Dos aberturas del mismo muro a menos de esto (mm) son la misma.
const SAME_APERTURE_MM = 600;

/** Aberturas medidas + las del modelo que no duplican ninguna del mismo muro; ids únicos. */
function mergeApertures(measured: PlanAperture[], model: PlanAperture[], walls: PlanWall[]): PlanAperture[] {
  const lengthOf = new Map(walls.map((w) => [w.id, Math.hypot(w.to.x - w.from.x, w.to.y - w.from.y)]));
  const out = [...measured];
  for (const a of model) {
    const len = lengthOf.get(a.wallId) ?? 0;
    const duplicate = out.findIndex((b) => b.wallId === a.wallId && Math.abs(b.position - a.position) * len < SAME_APERTURE_MM);
    if (duplicate < 0) out.push(a);
    // El hueco medido manda en la posición; el modelo aporta giro, bisagra y la carpintería que leyó.
    else if (a.swing || a.hinge || a.catalogId) out[duplicate] = {
      ...out[duplicate]!,
      ...(a.swing ? { swing: a.swing } : {}),
      ...(a.hinge ? { hinge: a.hinge } : {}),
      ...(a.catalogId && !out[duplicate]!.catalogId && [a.kind, 'hueco'].includes(out[duplicate]!.kind)
        ? { kind: a.kind, catalogId: a.catalogId } : {}),
    };
  }
  return out.map((a, i) => ({ ...a, id: `a${i}` }));
}

/** Clases de grosor (mm) de las bandas medidas: tabique y fachada. */
function thicknessClasses(prepared: PreparedSketch, scale: Scale): { thin: number; thick: number } {
  const fallback = prepared.opts.wallThicknessMm;
  if (!prepared.fromPixels) return { thin: fallback, thick: fallback };
  const mmPerUnit = (scale.mmPerUnitX + scale.mmPerUnitY) / 2;
  const measuredMm = prepared.sourceWalls.map((w) => (w.thickness === undefined ? undefined : w.thickness * mmPerUnit));
  const classes = [...new Set(classifyWallThickness(measuredMm, fallback))];
  return { thin: Math.min(...classes), thick: Math.max(...classes) };
}

function pointInPolygon(p: SketchPoint, polygon: SketchPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// ── Zonas ────────────────────────────────────────────────────────────────────

function buildZones(
  polys: Poly[],
  wallSegments: Segment[],
  planWalls: PlanWall[],
  apertures: PlanAperture[],
  scale: Scale,
): PlanZone[] {
  const zones: PlanZone[] = polys.map((poly, i) => ({
    id: `z${i}`,
    name: poly.room.nombre,
    outline: (poly.room.exterior === true ? poly.body : insetPolygon(poly.body, wallSegments, scale)).map((p) =>
      toMm(p.x, p.y, scale),
    ),
    walls: [],
    apertures: [],
    dimensions: [],
  }));
  const zoneOfWall = new Map<string, PlanZone>();
  wallSegments.forEach((s, i) => {
    const owner = s.owners.find((o) => polys[o]!.room.exterior !== true) ?? s.owners[0]!;
    const zone = zones[owner]!;
    const wall = planWalls[i]!;
    zone.walls.push(wall);
    zoneOfWall.set(wall.id, zone);
  });
  for (const ap of apertures) zoneOfWall.get(ap.wallId)?.apertures.push(ap);
  return zones;
}

/**
 * Cara INTERIOR de la estancia: cada arista retrocede medio grosor del muro
 * que la forma, para que la medida de la zona sea la luz entre caras (lo que
 * expresan las cotas escritas). Las aristas consecutivas son perpendiculares.
 */
function insetPolygon(points: SketchPoint[], segments: Segment[], scale: Scale): SketchPoint[] {
  const n = points.length;
  const shifted = points.map((a, i) => {
    const b = points[(i + 1) % n]!;
    const axis: Axis = a.x === b.x ? 'x' : 'y';
    const value = axis === 'x' ? a.x : a.y;
    const lo = axis === 'x' ? Math.min(a.y, b.y) : Math.min(a.x, b.x);
    const hi = axis === 'x' ? Math.max(a.y, b.y) : Math.max(a.x, b.x);
    const thicknessMm = Math.max(
      0,
      ...segments
        .filter((s) => s.axis === axis && s.value === value && Math.min(s.hi, hi) - Math.max(s.lo, lo) > 0)
        .map((s) => s.thicknessMm),
    );
    const mmPerUnit = axis === 'x' ? scale.mmPerUnitX : scale.mmPerUnitY;
    const half = thicknessMm / 2 / mmPerUnit;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const probe = axis === 'x' ? { x: mid.x + PROBE, y: mid.y } : { x: mid.x, y: mid.y + PROBE };
    const inwardPositive = pointInPolygon(probe, points);
    return { axis, value: value + (inwardPositive ? half : -half) };
  });
  return points.map((_, i) => {
    const before = shifted[(i + n - 1) % n]!;
    const after = shifted[i]!;
    // El vértice i es el encuentro de la arista anterior (i-1→i) y la actual (i→i+1).
    const x = before.axis === 'x' ? before.value : after.value;
    const y = before.axis === 'y' ? before.value : after.value;
    return { x, y };
  });
}

function toMm(x: number, y: number, s: Scale): PlanPoint {
  return { x: Math.round(x * s.mmPerUnitX), y: Math.round(y * s.mmPerUnitY) };
}
