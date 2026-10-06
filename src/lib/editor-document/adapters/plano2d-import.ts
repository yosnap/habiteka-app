/**
 * `PlanImportResult` → `EditorDocument` del Editor v2.
 *
 * Parte de la conversión congelada `fromPlano2d` (muros, huecos, etiquetas y
 * cotas) y añade lo que un plano importado trae de más: los límites ocultos de
 * las zonas exteriores como muros `hidden` (recinto lógico sin muro físico),
 * un acabado de suelo exterior para esas estancias, el tipo de carpintería de
 * cada puerta y ventana y el mobiliario del catálogo colocado. Cliente-safe y
 * puro.
 */
import type { PlanImportResult } from '@/lib/contracts';
import { doorSwing } from '@/lib/plan-svg/door-swing';
import { fromPlano2d } from './plano2d';
import { vertexId } from './shared';
import { planarizeWalls } from './planarize-walls';
import { deriveRooms } from '../rooms';
import { upgradeConstructionDocument } from '../migrations';
import { importedOpeningTypes } from '../imported-opening-types';
import { openingTypeLookPatch } from '../opening-look';
import { objectCenter, upgradeRampDocument } from '../spatial-properties';
import { assertEditorDocument } from '../validation';
import type { EditorDocument, FloorFinish, Point } from '../schema';

export interface PlanImportConversion {
  document: EditorDocument | null;
  issues: string[];
}

// Acabado por defecto de una zona exterior (baldosa clara), distinguible del interior.
const EXTERIOR_FINISH: Omit<FloorFinish, 'roomId'> = {
  color: '#d9d4c7',
  texture: 'tile',
  tileSizeMm: 400,
  rotation: 0,
  elevationMm: 0,
};

/** Construye el documento del editor a partir de la importación (ya corregida por el usuario). */
export function fromPlanImport(result: PlanImportResult): PlanImportConversion {
  const base = fromPlano2d(result.plano);
  if (!base.document) return { document: null, issues: base.issues };
  let doc = base.document;
  const issues = [...base.issues];

  // El adaptador genérico recibe milímetros físicos. Una extracción sin escala
  // confirmada usa esos milímetros solo como hipótesis: el editor y su puerta
  // de calidad deben conservar esta procedencia hasta que se calibre.
  if (result.escalaEstimada) {
    for (const wall of doc.walls) wall.dimensionalOrigin = 'raster';
    for (const opening of doc.openings) opening.dimensionalOrigin = 'raster';
  }

  // Muros ocultos: cierran la zona exterior para que el editor la derive como
  // estancia (suelo, etiqueta, mobiliario dentro) sin dibujar muro alguno.
  result.exteriors.forEach((zone, i) => {
    zone.hiddenBoundaries.forEach((edge, j) => {
      doc.walls.push({
        id: `hidden:${zone.id}:${j}`,
        name: zone.name,
        hidden: true,
        startVertexId: vertexId(doc, edge.from),
        endVertexId: vertexId(doc, edge.to),
        thicknessMm: 80,
        dimensionalOrigin: result.escalaEstimada ? 'raster' : 'physical',
      });
    });
    if (!doc.labels.some((l) => l.id === zone.id)) {
      doc.labels.push({ id: `label:ext:${i}`, text: zone.name, ...centroid(zone.outline) });
    }
  });

  // Tabiques reconstruidos y límites ocultos cruzan muros existentes: el
  // editor exige vértice compartido en cada cruce o unión en T.
  try {
    planarizeWalls(doc);
  } catch (error) {
    return { document: null, issues: [...issues, error instanceof Error ? error.message : 'Topología inválida'] };
  }

  // Tipo de carpintería: el que distinguió la lectura y, si no, las reglas de
  // fachada (puerta de entrada) y de patio (corredera de vidrio).
  const read = new Map(result.plano.zones.flatMap((zone) => zone.apertures)
    .flatMap((aperture) => aperture.catalogId ? [[aperture.id, aperture.catalogId] as const] : []));
  const types = importedOpeningTypes(doc, read);
  // El sentido de apertura y el tipo pertenecen al esquema de construcción (v3+).
  // Migrar antes de escribirlos evita invalidar el documento v2 de fromPlano2d.
  if (types.size || doc.openings.some((opening) => opening.kind === 'puerta')) {
    doc = upgradeConstructionDocument(doc);
  }
  for (const opening of doc.openings) {
    const type = types.get(opening.id);
    // Altura, cota y aspecto, los del tipo (una balconera llega al suelo); el ancho, el leído en el plano.
    if (type) Object.assign(opening, { kind: type.kind, catalogId: type.id, heightMm: type.heightMm, elevationMm: type.elevationMm,
      ...openingTypeLookPatch(type) });
  }
  // Sentido de apertura de cada puerta según las estancias (hacia la estancia,
  // no hacia el pasillo; las exteriores hacia dentro).
  const wallsById = new Map(result.plano.zones.flatMap((z) => z.walls).map((w) => [w.id, w]));
  for (const zone of result.plano.zones) {
    for (const aperture of zone.apertures) {
      const wall = wallsById.get(aperture.wallId);
      const opening = doc.openings.find((o) => o.id === aperture.id);
      // Un paso ancho al patio puede haberse convertido en puerta corredera.
      if (wall && opening?.kind === 'puerta') {
        opening.swing = doorSwing(aperture, wall, result.plano.zones);
        opening.hinge = aperture.hinge ?? 'left';
      }
    }
  }

  for (const item of result.furniture) {
    // La extracción da el CENTRO de la caja; el editor almacena el origen
    // local del objeto. El desplazamiento depende también del giro.
    const offset = objectCenter({ x: 0, y: 0, widthMm: item.widthMm, depthMm: item.depthMm, rotation: item.rotation });
    doc.furniture.push({
      id: `furniture:import:${item.id}`,
      name: item.label,
      kind: item.kind,
      catalogId: item.catalogId,
      x: item.x - offset.x,
      y: item.y - offset.y,
      widthMm: item.widthMm,
      depthMm: item.depthMm,
      rotation: item.rotation,
      // Viene de una caja leída en la imagen, no de una medida física.
      dimensionalOrigin: 'raster',
    });
  }

  // Acabados de suelo exterior: se asignan a la estancia DERIVADA que contiene
  // el centro de cada zona exterior (los ids de estancia dependen de los muros).
  if (result.exteriors.length === 0) return finish(doc, issues);

  // Los acabados de suelo existen desde la versión 5 del esquema; se sube el
  // documento por la cadena oficial de migraciones (construcción → espacial →
  // rampas) y se deja en la versión actual.
  let upgraded: EditorDocument;
  try {
    upgraded = upgradeRampDocument(doc);
  } catch (error) {
    return { document: null, issues: [...issues, error instanceof Error ? error.message : 'Documento inválido'] };
  }
  upgraded.schemaVersion = 7;
  // El editor da por hechas estas colecciones en un documento actual.
  upgraded.columns ??= [];
  // La derivación de estancias valida el documento: la colección debe existir ya.
  upgraded.floorFinishes = [];
  const finishes: FloorFinish[] = [];
  try {
    const rooms = deriveRooms(upgraded);
    for (const zone of result.exteriors) {
      const center = centroid(zone.outline);
      const room = rooms.find((r) => inside(center, r.boundary));
      if (room && !finishes.some((f) => f.roomId === room.id)) finishes.push({ roomId: room.id, ...EXTERIOR_FINISH });
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'No se pudieron derivar las zonas exteriores');
  }
  upgraded.floorFinishes = finishes;
  return finish(upgraded, issues);
}

function finish(doc: EditorDocument, issues: string[]): PlanImportConversion {
  try {
    assertEditorDocument(doc);
  } catch (error) {
    return { document: null, issues: [...issues, error instanceof Error ? error.message : 'Documento inválido'] };
  }
  return { document: doc, issues };
}

function centroid(points: Point[]): Point {
  const n = Math.max(1, points.length);
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

function inside(point: Point, polygon: Point[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
