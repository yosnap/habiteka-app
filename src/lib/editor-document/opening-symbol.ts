import type { Opening, Point } from './schema';
import { openingConstruction } from './construction-properties';
import { openingType } from './opening-types';
import { leafEnds, openingLeafLayout, type LeafPanel } from './opening-leaves';

/**
 * Trazo del símbolo en planta, en coordenadas locales de la abertura (x a lo largo del muro desde su centro, y hacia
 * la normal izquierda), en milímetros. `leaf` es la hoja; `arc`, su giro; `glass`, el vidrio de una ventana; `guide`,
 * la guía de una corredera; `pocket`, el cajón de una empotrada; `arrow`, el sentido en que se desliza.
 */
export interface SymbolStroke {
  role: 'leaf' | 'arc' | 'glass' | 'guide' | 'pocket' | 'arrow';
  points: number[];
  /** Polígono cerrado (hoja maciza o acristalada con su grosor, cajón). */
  closed?: boolean;
  dashed?: boolean;
  /** Relleno del polígono: madera de la hoja o vidrio. */
  fill?: 'leaf' | 'glass';
}

const ARC_STEP = Math.PI / 36;
const flat = (points: Point[]) => points.flatMap((point) => [point.x, point.y]);

function arc(pivot: Point, radius: number, from: number, delta: number): number[] {
  const steps = Math.max(2, Math.ceil(Math.abs(delta) / ARC_STEP));
  return flat(Array.from({ length: steps + 1 }, (_, index) => {
    const angle = from + delta * index / steps;
    return { x: pivot.x + Math.cos(angle) * radius, y: pivot.y + Math.sin(angle) * radius };
  }));
}

/** Hoja con su grosor real, como un rectángulo: así la blindada, la vidriera y las correderas se distinguen a simple vista. */
function slab(panel: LeafPanel, fill: 'leaf' | 'glass'): SymbolStroke {
  const [from, to] = leafEnds(panel), half = panel.thicknessMm / 2;
  const nx = -Math.sin(panel.angle) * half, ny = Math.cos(panel.angle) * half;
  return { role: 'leaf', closed: true, fill, points: flat([{ x: from.x - nx, y: from.y - ny }, { x: to.x - nx, y: to.y - ny },
    { x: to.x + nx, y: to.y + ny }, { x: from.x + nx, y: from.y + ny }]) };
}

function arrow(fromX: number, toX: number, y: number): SymbolStroke {
  const head = Math.min(120, Math.abs(toX - fromX) / 3), direction = Math.sign(toX - fromX) || 1;
  return { role: 'arrow', points: [fromX, y, toX, y, toX - direction * head, y - head / 2, toX, y, toX - direction * head, y + head / 2] };
}

/** Flecha perpendicular al muro, de `fromY` a `toY` en `x`: la seccional se recoge hacia dentro. */
function crossArrow(x: number, fromY: number, toY: number): SymbolStroke {
  const head = Math.min(120, Math.abs(toY - fromY) / 3), direction = Math.sign(toY - fromY) || 1;
  return { role: 'arrow', points: [x, fromY, x, toY, x - head / 2, toY - direction * head, x, toY, x + head / 2, toY - direction * head] };
}

/**
 * Arcos de una hoja abatible: el de su canto libre; en una pivotante, también el del tramo de hoja al otro lado del
 * eje; en una de vaivén, el giro hacia la otra cara en discontinuo.
 */
function swingArcs(hinge: NonNullable<LeafPanel['hinge']>, lengthMm: number): SymbolStroke[] {
  const offset = hinge.offsetMm ?? 0, reach = lengthMm - offset;
  return [{ role: 'arc', points: arc(hinge.pivot, reach, hinge.closedAngle, hinge.delta) },
    ...(offset ? [{ role: 'arc' as const, points: arc(hinge.pivot, offset, hinge.closedAngle + Math.PI, hinge.delta) }] : []),
    ...(hinge.doubleActing ? [{ role: 'arc' as const, dashed: true, points: arc(hinge.pivot, reach, hinge.closedAngle, -hinge.delta) }] : [])];
}

/**
 * Símbolo en planta de cada tipo, con la misma disposición de hojas que el 3D sobre el ancho completo, como el símbolo
 * histórico: arco simple o doble, corredera sin arco con su guía y flecha, cajón de la empotrada, zigzag de la plegable
 * y líneas de vidrio de cada ventana. Los tipos básicos los dibuja el lienzo con su símbolo de siempre.
 */
export function openingSymbol(opening: Opening, wallThicknessMm: number): SymbolStroke[] {
  const type = openingType(opening);
  const layout = type && openingLeafLayout(opening, opening.widthMm, wallThicknessMm);
  if (!type || !layout) return [];
  const width = opening.widthMm, half = width / 2, props = openingConstruction(opening);
  const side = props.swing === 'left' ? 1 : -1, hingeSide = props.hinge === 'left' ? -1 : 1;
  const glassOffset = wallThicknessMm / 6, outside = side * (wallThicknessMm / 2 + 90);
  const glassLine = (y: number, from = -half, to = half): SymbolStroke => ({ role: 'glass', points: [from, y, to, y] });
  // Giro simbólico de 90° de los paños de ventana hacia su cara de apertura, aunque estén cerrados.
  const windowArcs = (dashed: boolean) => layout.panels.flatMap((panel) => {
    if (!panel.hinge) return [];
    const delta = (panel.hinge.closedAngle === 0 ? 1 : -1) * side * Math.PI / 2, end = panel.hinge.closedAngle + delta;
    const tip = { x: panel.hinge.pivot.x + Math.cos(end) * panel.lengthMm, y: panel.hinge.pivot.y + Math.sin(end) * panel.lengthMm };
    return [{ role: 'arc' as const, dashed, points: arc(panel.hinge.pivot, panel.lengthMm, panel.hinge.closedAngle, delta) },
      ...(dashed ? [] : [{ role: 'leaf' as const, points: flat([panel.hinge.pivot, tip]) }])];
  });
  if (type.kind === 'ventana') switch (type.operation) {
    case 'fija': return [glassLine(-glassOffset), glassLine(glassOffset)];
    // Guillotina y corredera: un vidrio por hoja, cada uno en su carril.
    case 'guillotina':
    case 'corredera-marco': return layout.panels.map((panel) =>
      glassLine(Math.sign(panel.center.y) * glassOffset, panel.center.x - panel.lengthMm / 2, panel.center.x + panel.lengthMm / 2));
    // La balconera llega al suelo y se pisa como una puerta: arcos y hojas continuos; una ventana, arcos discontinuos.
    case 'abatible': return [glassLine(0), ...windowArcs(type.elevationMm > 0)];
    default: return [glassLine(0)];
  }
  const fill = type.glazed ? 'glass' : 'leaf';
  switch (type.operation) {
    case 'abatible': return layout.panels.flatMap((panel) => [
      ...(panel.hinge ? swingArcs(panel.hinge, panel.lengthMm) : []),
      // La hoja maciza de entrada y la vidriera se dibujan con su grosor; la básica, como una línea. La fija de una
      // hoja y media, igual que la principal pero sin arco.
      type.glazed || type.leafThicknessMm > 50 ? slab(panel, fill) : { role: 'leaf' as const, points: flat(leafEnds(panel)) },
    ]);
    case 'corredera': {
      const y = outside + side * type.leafThicknessMm;
      return [
        // La guía de granero es una pletina vista: se dibuja continua.
        ...(layout.rail ? [{ role: 'guide' as const, dashed: !type.barn, points: flat([layout.rail.from, layout.rail.to]) }] : []),
        ...layout.panels.map((panel) => slab(panel, fill)),
        ...(type.leaves >= 2 ? [arrow(0, -half, y), arrow(0, half, y)] : [arrow(0, hingeSide * half, y)]),
      ];
    }
    case 'seccional': case 'enrollable': case 'basculante': {
      // Panel o persiana por la cara interior y, en discontinuo, lo que ocupa abierta por encima del hueco: las guías
      // bajo el techo, el cajón de la enrollable o la hoja horizontal de la basculante, que sale un tercio a la calle.
      const overhead = layout.overhead ?? [], face = side * wallThicknessMm / 2;
      const arrows = type.operation === 'enrollable' ? []
        : type.operation === 'basculante' ? [crossArrow(0, -face - side * 150, -face - side * Math.min(700, props.heightMm / 3))]
          : [crossArrow(0, face + side * 150, face + side * Math.min(900, props.heightMm / 2))];
      return [...layout.panels.map((panel) => slab(panel, fill)),
        ...(overhead.length ? [{ role: 'pocket' as const, closed: true, dashed: true, points: flat(overhead) }] : []), ...arrows];
    }
    case 'corredera-empotrada': {
      // Cajón dentro del muro, del lado en que se recoge la hoja.
      const inset = Math.min(20, wallThicknessMm / 4), y = wallThicknessMm / 2 - inset;
      return [{ role: 'pocket', closed: true, dashed: true, points: [hingeSide * half, -y, hingeSide * (half + width), -y,
        hingeSide * (half + width), y, hingeSide * half, y] },
      ...layout.panels.map((panel) => slab(panel, fill)), arrow(0, hingeSide * half, outside)];
    }
    case 'corredera-marco': return [...layout.panels.map((panel) => slab(panel, fill)), ...(type.leaves >= 4
      ? [arrow(0, -half / 2, outside), arrow(0, half / 2, outside)] : [arrow(-hingeSide * half / 2, hingeSide * half / 2, outside)])];
    case 'plegable': return [{ role: 'leaf', points: flat(layout.panels.flatMap((panel, index) => {
      const [from, to] = leafEnds(panel);
      return index ? [to] : [from, to];
    })) }];
    default: return [];
  }
}
