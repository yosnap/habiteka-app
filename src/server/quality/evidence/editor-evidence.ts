/**
 * Evidencia MEDIBLE de la salud estructural del documento del editor, para que
 * Jev decida si merece la pena gastar en una generación de pago.
 *
 * Función pura sobre el `EditorDocument`: recorre todos los niveles del edificio
 * y reutiliza la geometría del propio editor (estancias derivadas, topología
 * planar, contrato de render). Solo números, booleanos y listas cortas — nunca
 * imágenes ni el JSON del plano —, porque Jev cobra por tokens de entrada y el
 * juicio debe caber en una sola llamada.
 */
import { buildingDocuments } from '@/lib/editor-document/building-levels';
import { distance, wallPoints } from '@/lib/editor-document/geometry';
import { buildEditorRenderContract } from '@/lib/editor-document/render-contract';
import { deriveRooms } from '@/lib/editor-document/rooms';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { assertPlanarTopology } from '@/lib/editor-document/topology';

/** Longitud por debajo de la cual un muro no aporta geometría (mm). */
const DEGENERATE_WALL_MM = 10;
/**
 * Un extremo suelto a esta distancia de otro muro deja un paso transitable sin
 * puerta (entrada, arco, pasillo abierto): es arquitectura, no un error. Más
 * cerca es un muro mal unido; más lejos, un muro que no llega a nada.
 */
const PASSAGE_MIN_MM = 600;
const PASSAGE_MAX_MM = 2500;

export interface EditorEvidence {
  niveles: number;
  muros: number;
  murosDegenerados: number;
  /** Extremos de muro sin unir que no forman un paso (defecto). */
  extremosSueltos: number;
  /** Extremos de muro que dejan un paso abierto sin puerta, a propósito. */
  pasosAbiertos: number;
  /** Muros cuya medida viene de la imagen importada, no de una cota física. */
  murosSinMedidaFisica: number;
  estancias: number;
  /** `false` si la geometría no permite derivar estancias (contorno roto). */
  estanciasDerivables: boolean;
  topologiaValida: boolean;
  /** Fallo geométrico dominante, tal cual lo describe el editor. */
  falloGeometria: string | null;
  huecos: number;
  huecosSinMuro: number;
  huecosFueraDeMuro: number;
  escalaConocida: boolean;
  suelos: number;
  suelosSinEstancia: number;
  plataformasElevadas: number;
  accesosVerticales: number;
  escalerasIncoherentes: number;
  rampasIncoherentes: number;
  muebles: number;
  columnas: number;
  elementosContrato: number;
  superficieSueloM2: number;
}

/** Construye la evidencia del punto de control `editor_structure`. */
export function buildEditorEvidence(document: EditorDocument): EditorEvidence {
  const levels = buildingDocuments(document);
  const evidence = emptyEvidence(levels.length);
  const fallos: string[] = [];

  for (const level of levels) {
    const doc = level.document;
    const rooms = safeRooms(doc, fallos);
    const roomIds = new Set(rooms?.map((room) => room.id) ?? []);
    const walls = new Map(doc.walls.map((wall) => [wall.id, wall]));

    evidence.muros += doc.walls.length;
    evidence.estancias += rooms?.length ?? 0;
    if (rooms === null) evidence.estanciasDerivables = false;
    if (!isPlanar(doc, fallos)) evidence.topologiaValida = false;

    for (const wall of doc.walls) {
      const [from, to] = wallPoints(doc, wall);
      if (distance(from, to) < DEGENERATE_WALL_MM) evidence.murosDegenerados += 1;
      if (wall.dimensionalOrigin === 'raster') evidence.murosSinMedidaFisica += 1;
    }
    const ends = danglingEnds(doc);
    evidence.extremosSueltos += ends.loose;
    evidence.pasosAbiertos += ends.passages;

    evidence.huecos += doc.openings.length;
    for (const opening of doc.openings) {
      const wall = walls.get(opening.wallId);
      if (!wall) {
        evidence.huecosSinMuro += 1;
        continue;
      }
      if (!fitsInWall(doc, wall, opening)) evidence.huecosFueraDeMuro += 1;
    }

    const finishes = doc.floorFinishes ?? [];
    evidence.suelos += finishes.length;
    evidence.suelosSinEstancia += rooms
      ? finishes.filter((finish) => !roomIds.has(finish.roomId)).length
      : 0;
    evidence.plataformasElevadas += finishes.filter((finish) => (finish.elevationMm ?? 0) > 0).length;

    const stairs = doc.stairs ?? [];
    const ramps = doc.ramps ?? [];
    evidence.accesosVerticales += stairs.length + ramps.length;
    evidence.escalerasIncoherentes += stairs.filter(
      (stair) => stair.heightMm <= 0 || stair.stepCount <= 0 || stair.widthMm <= 0 || stair.depthMm <= 0,
    ).length;
    evidence.rampasIncoherentes += ramps.filter(
      (ramp) => ramp.riseMm <= 0 || ramp.depthMm <= 0 || ramp.widthMm <= 0,
    ).length;

    evidence.muebles += doc.furniture.length;
    evidence.columnas += (doc.columns ?? []).length;
  }

  evidence.escalaConocida =
    document.calibration !== null || evidence.murosSinMedidaFisica === 0;
  evidence.falloGeometria = fallos[0] ?? null;

  const contract = safeContract(document);
  evidence.elementosContrato = contract?.elements.length ?? 0;
  evidence.superficieSueloM2 = contract?.totals.finishedFloorAreaM2 ?? 0;
  return evidence;
}

/**
 * Hechos medidos, en lenguaje del usuario final, que explican por qué el plano
 * no llega a fiabilidad alta. Solo lo que se puede señalar y corregir.
 */
export function explainEditorEvidence(evidence: EditorEvidence): string[] {
  const facts: string[] = [];
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (evidence.extremosSueltos > 0)
    facts.push(`${count(evidence.extremosSueltos, 'extremo de muro no se une', 'extremos de muro no se unen')} a ningún otro muro.`);
  if (evidence.murosDegenerados > 0)
    facts.push(`${count(evidence.murosDegenerados, 'muro tiene', 'muros tienen')} una longitud casi nula.`);
  if (!evidence.estanciasDerivables)
    facts.push('No se pueden deducir las estancias: algún contorno de muros está roto.');
  else if (evidence.muros > 0 && evidence.estancias === 0)
    facts.push('Los muros no forman ninguna estancia cerrada.');
  if (!evidence.topologiaValida && evidence.falloGeometria)
    facts.push(`Geometría: ${evidence.falloGeometria}`);
  if (evidence.murosSinMedidaFisica > 0 && !evidence.escalaConocida)
    facts.push(`${evidence.murosSinMedidaFisica} de ${evidence.muros} muros tienen medidas tomadas de la imagen y el plano no tiene escala definida.`);
  if (evidence.huecosSinMuro > 0)
    facts.push(`${count(evidence.huecosSinMuro, 'puerta o ventana no está', 'puertas o ventanas no están')} sobre ningún muro.`);
  if (evidence.huecosFueraDeMuro > 0)
    facts.push(`${count(evidence.huecosFueraDeMuro, 'puerta o ventana sobresale', 'puertas o ventanas sobresalen')} de su muro.`);
  if (evidence.suelosSinEstancia > 0)
    facts.push(`${count(evidence.suelosSinEstancia, 'acabado de suelo no corresponde', 'acabados de suelo no corresponden')} a ninguna estancia.`);
  const vertical = evidence.escalerasIncoherentes + evidence.rampasIncoherentes;
  if (vertical > 0) facts.push(`${count(vertical, 'escalera o rampa tiene', 'escaleras o rampas tienen')} medidas incoherentes.`);
  if (!facts.length)
    facts.push('No hemos medido ningún defecto concreto en el plano: la duda viene de la valoración automática global. Revisa las vistas antes de generar.');
  return facts;
}

function emptyEvidence(niveles: number): EditorEvidence {
  return {
    niveles,
    muros: 0,
    murosDegenerados: 0,
    extremosSueltos: 0,
    pasosAbiertos: 0,
    murosSinMedidaFisica: 0,
    estancias: 0,
    estanciasDerivables: true,
    topologiaValida: true,
    falloGeometria: null,
    huecos: 0,
    huecosSinMuro: 0,
    huecosFueraDeMuro: 0,
    escalaConocida: false,
    suelos: 0,
    suelosSinEstancia: 0,
    plataformasElevadas: 0,
    accesosVerticales: 0,
    escalerasIncoherentes: 0,
    rampasIncoherentes: 0,
    muebles: 0,
    columnas: 0,
    elementosContrato: 0,
    superficieSueloM2: 0,
  };
}

/** Estancias del nivel, o `null` si el contorno está roto (el motivo se anota). */
function safeRooms(doc: EditorDocument, fallos: string[]) {
  try {
    return deriveRooms(doc);
  } catch (error) {
    fallos.push(shortMessage(error));
    return null;
  }
}

function isPlanar(doc: EditorDocument, fallos: string[]): boolean {
  try {
    assertPlanarTopology(doc);
    return true;
  } catch (error) {
    fallos.push(shortMessage(error));
    return false;
  }
}

function safeContract(document: EditorDocument) {
  try {
    return buildEditorRenderContract(document);
  } catch {
    return null;
  }
}

/** Extremos de muro que no comparten vértice con ningún otro muro del nivel. */
function danglingEnds(doc: EditorDocument): { loose: number; passages: number } {
  const uses = new Map<string, number>();
  for (const wall of doc.walls)
    for (const id of [wall.startVertexId, wall.endVertexId])
      uses.set(id, (uses.get(id) ?? 0) + 1);
  const segments = doc.walls.map((wall) => ({ wall, points: wallPoints(doc, wall) }));
  let loose = 0, passages = 0;
  for (const { wall, points } of segments) {
    for (const [index, id] of [wall.startVertexId, wall.endVertexId].entries()) {
      if (uses.get(id) !== 1) continue;
      const end = points[index]!;
      const gap = Math.min(Infinity, ...segments.filter((other) => other.wall.id !== wall.id)
        .map((other) => distanceToSegment(end, other.points[0], other.points[1])));
      if (gap >= PASSAGE_MIN_MM && gap <= PASSAGE_MAX_MM) passages += 1; else loose += 1;
    }
  }
  return { loose, passages };
}

function distanceToSegment(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y, lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq)) : 0;
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Un hueco cabe si su centro y su ancho quedan dentro del muro que lo sostiene. */
function fitsInWall(
  doc: EditorDocument,
  wall: EditorDocument['walls'][number],
  opening: EditorDocument['openings'][number],
): boolean {
  const [from, to] = wallPoints(doc, wall);
  const length = distance(from, to);
  if (length <= 0 || opening.widthMm <= 0) return false;
  if (opening.position < 0 || opening.position > 1) return false;
  const half = opening.widthMm / 2 / length;
  return opening.position - half >= -1e-6 && opening.position + half <= 1 + 1e-6;
}

function shortMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Geometría inconsistente';
  return message.slice(0, 160);
}
