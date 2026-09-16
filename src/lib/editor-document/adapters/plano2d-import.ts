/**
 * `PlanImportResult` → `EditorDocument` del Editor v2.
 *
 * Parte de la conversión congelada `fromPlano2d` (muros, huecos, etiquetas y
 * cotas) y añade lo que un plano importado trae de más: los límites ocultos de
 * las zonas exteriores como muros `hidden` (recinto lógico sin muro físico),
 * un acabado de suelo exterior para esas estancias y el mobiliario del
 * catálogo colocado. Cliente-safe y puro.
 */
import type { PlanImportResult } from '@/lib/contracts';
import { doorSwing } from '@/lib/plan-svg/door-swing';
import { fromPlano2d } from './plano2d';
import { vertexId } from './shared';
import { planarizeWalls } from './planarize-walls';
import { deriveRooms } from '../rooms';
import { upgradeRampDocument } from '../spatial-properties';
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
  const doc = base.document;
  const issues = [...base.issues];

  // Sentido de apertura de cada puerta según las estancias (hacia la estancia,
  // no hacia el pasillo; las exteriores hacia dentro).
  const wallsById = new Map(result.plano.zones.flatMap((z) => z.walls).map((w) => [w.id, w]));
  for (const zone of result.plano.zones) {
    for (const aperture of zone.apertures) {
      if (aperture.kind !== 'puerta') continue;
      const wall = wallsById.get(aperture.wallId);
      const opening = doc.openings.find((o) => o.id === aperture.id);
      if (wall && opening) opening.swing = doorSwing(aperture, wall, result.plano.zones);
    }
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
        dimensionalOrigin: 'physical',
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

  for (const item of result.furniture) {
    doc.furniture.push({
      id: `furniture:import:${item.id}`,
      name: item.label,
      kind: item.kind,
      catalogId: item.catalogId,
      x: item.x,
      y: item.y,
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
