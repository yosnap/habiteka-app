/**
 * Incidencias localizables del plano y sus reparaciones automáticas.
 *
 * Se comprueba sobre una sala cerrada dibujada con las mismas operaciones que
 * usa el editor: que un descansillo con desnivel cero NO es una rampa
 * incoherente, que un tabique de 6 mm se funde sin abrir el contorno y que los
 * acabados de suelo de estancias inexistentes se pueden limpiar.
 */
import { describe, expect, it } from 'vitest';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument, type EditorDocument, type Ramp } from '@/lib/editor-document/schema';
import { RAMP_LANDING_CATALOG_ID } from '@/lib/editor-document/ramp-kind';
import { upgradeRampDocument } from '@/lib/editor-document/spatial-properties';
import { setFloorFinish } from '@/lib/editor-document/floor-finishes';
import { danglingEnds, planDefects, planIssueMessage, planIssues } from '@/lib/editor-document/plan-issues';
import {
  collapseDegenerateWalls,
  pruneOrphanFloorFinishes,
} from '@/lib/editor-document/plan-repairs';
import { explainEditorEvidence, buildEditorEvidence } from '@/server/quality/evidence/editor-evidence';
import { deriveRooms } from '@/lib/editor-document/rooms';

const CORNERS = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];

it('localiza los extremos exactos sin marcar las esquinas compartidas de una sala cerrada', () => {
  const closed = room();
  expect(danglingEnds(closed).points).toEqual([]);
  const extended = addWallPath(closed, [{ x: 10000, y: 10000 }, { x: 14000, y: 10000 }], false);
  const wallId = extended.walls.at(-1)!.id;
  expect(danglingEnds(extended).points).toEqual([
    { x: 10000, y: 10000, wallId }, { x: 14000, y: 10000, wallId },
  ]);
  expect(planIssues(extended).find((issue) => issue.kind === 'extremos-sueltos')?.ids).toEqual([wallId]);
});

/** Sala cerrada al día en esquema, con colecciones de rampas y acabados. */
function room(): EditorDocument {
  return upgradeRampDocument(addWallPath(emptyEditorDocument(), CORNERS, true));
}

function ramp(patch: Partial<Ramp>): Ramp {
  return {
    id: crypto.randomUUID(),
    catalogId: 'builtin:ramp-straight',
    x: 1000,
    y: 1000,
    rotation: 0,
    widthMm: 1000,
    depthMm: 1200,
    riseMm: 180,
    elevationMm: 0,
    materialId: 'concrete-grey',
    ...patch,
  };
}

describe('planIssues: rampas y descansillos', () => {
  it('un descansillo con desnivel cero no es una rampa incoherente', () => {
    const landing = ramp({ catalogId: RAMP_LANDING_CATALOG_ID, riseMm: 0 });
    const doc = { ...room(), ramps: [landing] };
    expect(planDefects(doc).incoherentRampIds).toEqual([]);
    expect(buildEditorEvidence(doc).rampasIncoherentes).toBe(0);
    expect(planIssues(doc).some((issue) => issue.kind === 'accesos-incoherentes')).toBe(false);
  });

  it('una rampa de verdad sin desnivel sí es incoherente', () => {
    const flat = ramp({ riseMm: 0 });
    const doc = { ...room(), ramps: [flat] };
    expect(planDefects(doc).incoherentRampIds).toEqual([flat.id]);
    expect(buildEditorEvidence(doc).rampasIncoherentes).toBe(1);
  });

  it('un descansillo con anchura imposible sigue siendo incoherente', () => {
    const broken = ramp({ catalogId: RAMP_LANDING_CATALOG_ID, riseMm: 0, widthMm: 0 });
    expect(planDefects({ ...room(), ramps: [broken] }).incoherentRampIds).toEqual([broken.id]);
  });
});

describe('planIssues', () => {
  it('señala puertas estrechas con la medida real del hueco, sin modificarlo ni incluir ventanas', () => {
    const doc = room(), wallId = doc.walls[0]!.id;
    doc.openings = [
      { id: 'estrecha', wallId, kind: 'puerta', position: .2, widthMm: 530, dimensionalOrigin: 'physical' },
      { id: 'limite', wallId, kind: 'puerta', position: .5, widthMm: 650, dimensionalOrigin: 'physical' },
      { id: 'ventana', wallId, kind: 'ventana', position: .8, widthMm: 530, dimensionalOrigin: 'physical' },
    ];
    const before = structuredClone(doc);
    expect(planIssues(doc).find(issue => issue.kind === 'puertas-estrechas')).toMatchObject({ ids: ['estrecha'] });
    expect(buildEditorEvidence(doc).puertasEstrechas).toBe(1);
    expect(explainEditorEvidence(buildEditorEvidence(doc))).toContain(planIssueMessage('puertas-estrechas', 1));
    expect(doc).toEqual(before);
  });

  it('un plano sano no tiene ninguna incidencia', () => {
    expect(planIssues(room())).toEqual([]);
  });

  it('los mensajes coinciden con los motivos de la tarjeta de fiabilidad', () => {
    const doc = withPartition();
    const issue = planIssues(doc).find((item) => item.kind === 'muros-degenerados');
    expect(issue?.message).toBe(planIssueMessage('muros-degenerados', 1));
    expect(explainEditorEvidence(buildEditorEvidence(doc))).toContain(issue!.message);
  });

  it('el muro casi nulo se puede señalar y reparar', () => {
    const issue = planIssues(withPartition()).find((item) => item.kind === 'muros-degenerados')!;
    expect(issue.ids).toHaveLength(1);
    expect(issue.fix).toBe('collapse-degenerate-walls');
  });

  it('los acabados huérfanos solo se pueden limpiar, no señalar', () => {
    const doc = withOrphanFinishes();
    const issue = planIssues(doc).find((item) => item.kind === 'suelos-sin-estancia')!;
    expect(issue.ids).toEqual([]);
    expect(issue.fix).toBe('prune-orphan-floor-finishes');
    expect(issue.message).toBe(planIssueMessage('suelos-sin-estancia', 2));
  });
});

/** Sala cerrada con un tabique de 6 mm colgando de la esquina entre dos muros. */
function withPartition(): EditorDocument {
  const base = room();
  const corner = base.vertices.find((vertex) => vertex.x === 4000 && vertex.y === 0)!;
  const stub = { id: crypto.randomUUID(), x: 4000 - 4, y: 4 };
  return {
    ...base,
    vertices: [...base.vertices, stub],
    walls: [
      ...base.walls,
      { ...base.walls[0]!, id: crypto.randomUUID(), startVertexId: corner.id, endVertexId: stub.id },
    ],
  };
}

/** Un acabado bueno y dos de estancias que ya no existen (muros redibujados). */
function withOrphanFinishes(): EditorDocument {
  const doc = withFinish();
  const real = doc.floorFinishes![0]!;
  return {
    ...doc,
    floorFinishes: [
      real,
      { ...real, roomId: 'room:["a","b","c"]' },
      { ...real, roomId: 'room:["d","e","f"]' },
    ],
  };
}

/** Sala cerrada con el acabado de suelo de su única estancia. */
function withFinish(): EditorDocument {
  const base = room();
  return setFloorFinish(base, deriveRooms(base)[0]!.id, { color: '#c7ae88' });
}

describe('collapseDegenerateWalls', () => {
  it('funde el tabique casi nulo y deja el contorno cerrado', () => {
    const before = withPartition();
    expect(planDefects(before).degenerateWallIds).toHaveLength(1);
    const after = collapseDegenerateWalls(before);
    expect(planDefects(after).degenerateWallIds).toEqual([]);
    expect(after.walls).toHaveLength(4);
    expect(after.vertices).toHaveLength(4);
    expect(deriveRooms(after)).toHaveLength(1);
    expect(planDefects(after).looseEnds).toBe(0);
  });

  it('se niega cuando no hay nada que fundir', () => {
    expect(() => collapseDegenerateWalls(room())).toThrow(/longitud casi nula/);
  });
});

describe('pruneOrphanFloorFinishes', () => {
  it('quita solo los acabados sin estancia', () => {
    const after = pruneOrphanFloorFinishes(withOrphanFinishes());
    expect(after.floorFinishes).toHaveLength(1);
    expect(planDefects(after).orphanFloorFinishRoomIds).toEqual([]);
  });

  it('se niega cuando todos los acabados tienen estancia', () => {
    expect(() => pruneOrphanFloorFinishes(withFinish())).toThrow(/huérfanos/);
  });
});
