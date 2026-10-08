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
import { buildEditorRenderContract } from '@/lib/editor-document/render-contract';
import { deriveRooms } from '@/lib/editor-document/rooms';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { assertPlanarTopology } from '@/lib/editor-document/topology';
import { planDefects, planIssueMessage } from '@/lib/editor-document/plan-issues';

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
  puertasEstrechas: number;
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
    const defects = planDefects(doc);

    evidence.muros += doc.walls.length;
    evidence.estancias += rooms?.length ?? 0;
    if (rooms === null) evidence.estanciasDerivables = false;
    if (!isPlanar(doc, fallos)) evidence.topologiaValida = false;

    evidence.murosDegenerados += defects.degenerateWallIds.length;
    evidence.murosSinMedidaFisica += doc.walls.filter(
      (wall) => wall.dimensionalOrigin === 'raster',
    ).length;
    evidence.extremosSueltos += defects.looseEnds;
    evidence.pasosAbiertos += defects.passages;

    evidence.huecos += doc.openings.length;
    evidence.huecosSinMuro += defects.openingsWithoutWall.length;
    evidence.huecosFueraDeMuro += defects.openingsOutsideWall.length;
    evidence.puertasEstrechas += defects.narrowDoorIds.length;

    const finishes = doc.floorFinishes ?? [];
    evidence.suelos += finishes.length;
    evidence.suelosSinEstancia += defects.orphanFloorFinishRoomIds?.length ?? 0;
    evidence.plataformasElevadas += finishes.filter((finish) => (finish.elevationMm ?? 0) > 0).length;

    evidence.accesosVerticales += (doc.stairs ?? []).length + (doc.ramps ?? []).length;
    evidence.escalerasIncoherentes += defects.incoherentStairIds.length;
    evidence.rampasIncoherentes += defects.incoherentRampIds.length;

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
  if (evidence.extremosSueltos > 0)
    facts.push(planIssueMessage('extremos-sueltos', evidence.extremosSueltos));
  if (evidence.murosDegenerados > 0)
    facts.push(planIssueMessage('muros-degenerados', evidence.murosDegenerados));
  if (!evidence.estanciasDerivables)
    facts.push('No se pueden deducir las estancias: algún contorno de muros está roto.');
  else if (evidence.muros > 0 && evidence.estancias === 0)
    facts.push('Los muros no forman ninguna estancia cerrada.');
  if (!evidence.topologiaValida && evidence.falloGeometria)
    facts.push(`Geometría: ${evidence.falloGeometria}`);
  if (evidence.murosSinMedidaFisica > 0 && !evidence.escalaConocida)
    facts.push(`${evidence.murosSinMedidaFisica} de ${evidence.muros} muros tienen medidas tomadas de la imagen y el plano no tiene escala definida.`);
  if (evidence.huecosSinMuro > 0)
    facts.push(planIssueMessage('huecos-sin-muro', evidence.huecosSinMuro));
  if (evidence.huecosFueraDeMuro > 0)
    facts.push(planIssueMessage('huecos-fuera-de-muro', evidence.huecosFueraDeMuro));
  if (evidence.puertasEstrechas > 0)
    facts.push(planIssueMessage('puertas-estrechas', evidence.puertasEstrechas));
  if (evidence.suelosSinEstancia > 0)
    facts.push(planIssueMessage('suelos-sin-estancia', evidence.suelosSinEstancia));
  const vertical = evidence.escalerasIncoherentes + evidence.rampasIncoherentes;
  if (vertical > 0) facts.push(planIssueMessage('accesos-incoherentes', vertical));
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
    puertasEstrechas: 0,
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

function shortMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Geometría inconsistente';
  return message.slice(0, 160);
}
