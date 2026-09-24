import { describe, expect, it } from 'vitest';
import { emptyEditorDocument, type EditorDocument, type Point } from '@/lib/editor-document/schema';
import { addWallPath, deleteEntities } from '@/canvas/editor-v2/editing-operations';
import { addKitchenRun, updateKitchenRun } from '@/lib/editor-document/kitchen-run-commands';
import { addUnderCabinetStrip, refitLightStrip, setLightStripPath } from '@/lib/editor-document/light-strip-commands';
import {
  lightStripIssue,
  resolvedStrips,
  stripRoomId,
  UNDER_CABINET_DROP_MM,
  UNDER_CABINET_END_INSET_MM,
  UNDER_CABINET_FRONT_INSET_MM,
} from '@/lib/editor-document/light-strip-geometry';
import { stripLengthMm } from '@/lib/editor-document/light-strip-types';
import { ceilingWarnings } from '@/lib/editor-document/ceiling-geometry';
import { deriveRooms } from '@/lib/editor-document/rooms';

const UPPERS = { bottomMm: 1450, heightMm: 700, depthMm: 350, color: '#efe7db' };

/** Estancia rectangular amplia donde apoyar el tramo de cocina. */
const room = () => addWallPath(emptyEditorDocument(), [
  { x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 },
], true);

/** Plano con un tramo de cocina trazado entre dos puntos; `uppers` opcional. */
function kitchen(from: Point, to: Point, withUppers = true): { doc: EditorDocument; runId: string } {
  let doc = addKitchenRun(room(), from, to);
  const runId = doc.kitchenRuns![0]!.id;
  if (withUppers) {
    const run = doc.kitchenRuns![0]!;
    doc = updateKitchenRun(doc, runId, { kitchen: { ...run.kitchen, uppers: { ...UPPERS } } });
  }
  return { doc, runId };
}

const stripOf = (doc: EditorDocument) => doc.lightStrips![0]!;
/** Recorrido esperado de la tira calculado a mano desde el origen y el giro del tramo. */
function expectedPath(origin: Point, degrees: number, widthMm: number): Point[] {
  const angle = (degrees * Math.PI) / 180, depth = UPPERS.depthMm - UNDER_CABINET_FRONT_INSET_MM;
  return [UNDER_CABINET_END_INSET_MM, widthMm - UNDER_CABINET_END_INSET_MM].map((along) => ({
    x: origin.x + Math.cos(angle) * along - Math.sin(angle) * depth,
    y: origin.y + Math.sin(angle) * along + Math.cos(angle) * depth,
  }));
}
const closeTo = (path: readonly Point[], expected: readonly Point[]) => {
  expect(path).toHaveLength(expected.length);
  path.forEach((point, index) => {
    expect(point.x).toBeCloseTo(expected[index]!.x, 6);
    expect(point.y).toBeCloseTo(expected[index]!.y, 6);
  });
};

describe('alta de la tira bajo módulos altos', () => {
  it('exige módulos altos en el tramo', () => {
    const { doc, runId } = kitchen({ x: 500, y: 300 }, { x: 4500, y: 300 }, false);
    expect(() => addUnderCabinetStrip(doc, runId)).toThrow('módulos altos');
  });

  it('crea una tira derivada que recorre el tramo menos 50 mm por extremo', () => {
    const { doc, runId } = kitchen({ x: 500, y: 300 }, { x: 4500, y: 300 });
    const next = addUnderCabinetStrip(doc, runId);
    const strip = stripOf(next);
    expect(strip.kind).toBe('under-cabinet');
    expect(strip.derived).toBe(true);
    expect(strip.kitchenRunId).toBe(runId);
    expect(stripLengthMm(strip.pathMm)).toBeCloseTo(4000 - 2 * UNDER_CABINET_END_INSET_MM, 6);
    expect(strip.elevationMm).toBe(UPPERS.bottomMm - UNDER_CABINET_DROP_MM);
    expect(lightStripIssue(next, strip)).toBeNull();
  });

  it('rechaza una segunda tira sobre el mismo tramo', () => {
    const { doc, runId } = kitchen({ x: 500, y: 300 }, { x: 4500, y: 300 });
    const next = addUnderCabinetStrip(doc, runId);
    expect(() => addUnderCabinetStrip(next, runId)).toThrow('ya tiene tira');
  });

  it('tira y tramo comparten estancia', () => {
    const { doc, runId } = kitchen({ x: 500, y: 300 }, { x: 4500, y: 300 });
    const next = addUnderCabinetStrip(doc, runId);
    expect(stripRoomId(next, stripOf(next))).toBe(deriveRooms(next)[0]!.id);
  });

  it('ilumina hacia abajo, sobre la encimera', () => {
    const { doc, runId } = kitchen({ x: 500, y: 300 }, { x: 4500, y: 300 });
    const [resolved] = resolvedStrips(addUnderCabinetStrip(doc, runId));
    expect(resolved!.direction).toBe('down');
  });
});

describe('recorrido derivado en cualquier giro', () => {
  const cases: [string, Point, Point, number][] = [
    ['a 0°', { x: 500, y: 300 }, { x: 4500, y: 300 }, 0],
    ['a 90°', { x: 1000, y: 500 }, { x: 1000, y: 4500 }, 90],
    ['a 37°', { x: 1000, y: 800 }, {
      x: 1000 + Math.cos((37 * Math.PI) / 180) * 3000,
      y: 800 + Math.sin((37 * Math.PI) / 180) * 3000,
    }, 37],
  ];
  for (const [name, from, to, degrees] of cases) {
    it(`coloca la tira bajo los altos con el tramo ${name}`, () => {
      const { doc, runId } = kitchen(from, to);
      const next = addUnderCabinetStrip(doc, runId);
      closeTo(stripOf(next).pathMm, expectedPath(from, degrees, doc.kitchenRuns![0]!.widthMm));
      closeTo(resolvedStrips(next)[0]!.pathMm, stripOf(next).pathMm);
    });
  }

  it('alargar el tramo alarga la tira sin desligarla', () => {
    const { doc, runId } = kitchen({ x: 500, y: 300 }, { x: 4500, y: 300 });
    const withStrip = addUnderCabinetStrip(doc, runId);
    const longer = updateKitchenRun(withStrip, runId, { widthMm: 5000 });
    const strip = stripOf(longer);
    expect(strip.derived).toBe(true);
    expect(stripLengthMm(strip.pathMm)).toBeCloseTo(5000 - 2 * UNDER_CABINET_END_INSET_MM, 6);
  });

  it('girar el tramo 90° arrastra la tira derivada', () => {
    const { doc, runId } = kitchen({ x: 1000, y: 1000 }, { x: 5000, y: 1000 });
    const withStrip = addUnderCabinetStrip(doc, runId);
    const turned = updateKitchenRun(withStrip, runId, { rotation: 90 });
    const run = turned.kitchenRuns![0]!;
    closeTo(stripOf(turned).pathMm, expectedPath(run, run.rotation, run.widthMm));
  });
});

describe('tira ajustada a mano', () => {
  const edited = () => {
    const { doc, runId } = kitchen({ x: 500, y: 300 }, { x: 4500, y: 300 });
    const withStrip = addUnderCabinetStrip(doc, runId);
    const id = stripOf(withStrip).id;
    // Dentro del fondo de los altos, pero más corta por el extremo derecho.
    return { doc: setLightStripPath(withStrip, id, [{ x: 900, y: 600 }, { x: 4000, y: 600 }]), id, runId };
  };

  it('deja de seguir al mueble', () => {
    const { doc } = edited();
    expect(stripOf(doc).derived).toBe(false);
    expect(lightStripIssue(doc, stripOf(doc))).toBeNull();
  });

  it('no se mueve con el tramo y avisa cuando se descuelga', () => {
    const { doc, runId } = edited();
    const moved = updateKitchenRun(doc, runId, { y: 3000 });
    expect(stripOf(moved).pathMm).toEqual([{ x: 900, y: 600 }, { x: 4000, y: 600 }]);
    expect(lightStripIssue(moved, stripOf(moved))).toBe('La tira ajustada a mano ya no queda bajo el mueble; reajústala');
  });

  it('«Reajustar al mueble» la devuelve bajo los altos', () => {
    const { doc, id, runId } = edited();
    const moved = updateKitchenRun(doc, runId, { y: 3000 });
    const refitted = refitLightStrip(moved, id);
    const run = refitted.kitchenRuns![0]!;
    expect(stripOf(refitted).derived).toBe(true);
    closeTo(stripOf(refitted).pathMm, expectedPath(run, run.rotation, run.widthMm));
    expect(lightStripIssue(refitted, stripOf(refitted))).toBeNull();
  });
});

describe('ciclo de vida junto al tramo', () => {
  it('retirar los módulos altos deja la tira en incidencia, no la borra', () => {
    const { doc, runId } = kitchen({ x: 500, y: 300 }, { x: 4500, y: 300 });
    const withStrip = addUnderCabinetStrip(doc, runId);
    const run = withStrip.kitchenRuns![0]!;
    const rest = { ...run.kitchen };
    delete rest.uppers;
    const without = updateKitchenRun(withStrip, runId, { kitchen: rest });
    expect(without.lightStrips).toHaveLength(1);
    expect(lightStripIssue(without, stripOf(without))).toBe('El tramo de cocina no tiene módulos altos');
    expect(ceilingWarnings(without).some((warning) => warning.includes('no tiene módulos altos'))).toBe(true);
  });

  it('borrar el tramo borra su tira, derivada o ajustada a mano', () => {
    for (const manual of [false, true]) {
      const { doc, runId } = kitchen({ x: 500, y: 300 }, { x: 4500, y: 300 });
      let withStrip = addUnderCabinetStrip(doc, runId);
      if (manual) withStrip = setLightStripPath(withStrip, stripOf(withStrip).id, [{ x: 900, y: 600 }, { x: 4000, y: 600 }]);
      const deleted = deleteEntities(withStrip, [runId]);
      expect(deleted.kitchenRuns).toHaveLength(0);
      expect(deleted.lightStrips).toHaveLength(0);
    }
  });
});
