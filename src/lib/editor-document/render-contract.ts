import { boundaryDesignContext, BOUNDARY_RENDER_POLICY } from './boundary-context';
import type { EditorDocument, Point } from './schema';
import { buildingDocuments } from './building-levels';
import { floorFinish, floorSlabThicknessMm } from './floor-finishes';
import { surfaceMaterial } from './surface-materials';
import { isRampLanding } from './ramp-kind';
import { rampParts } from './ramp-route';
import { deriveRooms } from './rooms';
import { wallPath } from './wall-path';
import { ceilingDesignContext, CEILING_RENDER_POLICY } from './ceiling-design-context';

const meters = (value: number) => Number((value / 1000).toFixed(3));
const area = (value: number) => Number((value / 1_000_000).toFixed(2));
const degrees = (value: number) => ((value % 360) + 360) % 360;

export interface RenderContractElement {
  id: string;
  sourceId: string;
  type: string;
  name: string;
  level: string;
  dimensions?: Record<string, number>;
  position?: { x: number; y: number; elevation: number };
  rotationDeg?: number;
  boundary?: Point[];
  attributes?: Record<string, string | number | boolean>;
  areaM2?: number;
  relationships?: string[];
}

export interface EditorRenderContract {
  format: 'habiteka-render-contract-v1';
  units: 'm';
  spaceKind: EditorDocument['designSpaceKind'] | null;
  elements: RenderContractElement[];
  totals: { finishedFloorAreaM2: number };
  invariants: string[];
  /** Datos trazables para el auditor; no se envían al generador de imagen. */
  auditPrompt: string;
  /** Restricciones geométricas sin IDs que el modelo pueda dibujar como texto. */
  prompt: string;
}

/**
 * Traduce el documento editable a restricciones que un modelo de imagen puede
 * leer sin tener que inferir qué representa cada número del JSON del canvas.
 * Las cifras se mantienen también como datos para poder validarlas en servicios
 * posteriores, mientras que `prompt` es la versión legible que se manda hoy.
 */
export function buildEditorRenderContract(doc: EditorDocument): EditorRenderContract {
  const elements: RenderContractElement[] = [];
  const counts = new Map<string, number>();
  const nextId = (prefix: string) => {
    const index = (counts.get(prefix) ?? 0) + 1;
    counts.set(prefix, index);
    return `${prefix}-${String(index).padStart(2, '0')}`;
  };

  for (const level of buildingDocuments(doc)) {
    const source = level.document;
    const levelName = level.id;
    let rooms: ReturnType<typeof deriveRooms> = [];
    try {
      rooms = deriveRooms(source);
    } catch {
      // Un plano aún abierto conserva sus elementos individuales.
    }

    for (const room of rooms) {
      const finish = floorFinish(source, room.id);
      const elevationMm = finish.elevationMm ?? 0;
      const slabDepthMm = floorSlabThicknessMm(finish);
      elements.push({
        id: nextId('F'), sourceId: room.id, type: 'suelo acabado', name: `Suelo ${room.id}`, level: levelName,
        areaM2: area(room.areaMm2),
        dimensions: {
          perimeter: meters(room.boundary.reduce((sum, point, index) => sum + distance(point, room.boundary[(index + 1) % room.boundary.length]!), 0)),
          finishedElevation: meters(elevationMm), undersideElevation: meters(Math.max(0, elevationMm - slabDepthMm)),
          slabDepth: meters(slabDepthMm),
        },
        attributes: {
          'acabado superior': surfaceMaterial(finish.texture)?.label ?? finish.texture,
          'color superior': finish.color,
          ...(elevationMm > 0 ? {
            'acabado del canto y cara inferior': surfaceMaterial(finish.undersideTexture)?.label ?? 'sin textura',
            'color del canto y cara inferior': finish.undersideColor ?? '#756f66',
          } : {}),
        },
        relationships: elevationMm > 0
          ? ['Plataforma elevada: las circulaciones que llegan a este suelo terminan en su cota de acabado.']
          : ['Suelo a cota de la planta.'],
      });
    }

    const overhead = ceilingDesignContext(source);
    for (const ceiling of overhead.ceilings) {
      elements.push({
        id: nextId('T'), sourceId: ceiling.id, type: ceiling.kind === 'suspended' ? 'falso techo' : 'techo plano',
        name: 'Techo aceptado', level: levelName, boundary: ceiling.boundaryM,
        dimensions: { height: ceiling.heightM, drop: ceiling.dropM },
        attributes: { color: ceiling.color },
        relationships: ['Contorno de su estancia; no extender a otros recintos.'],
      });
    }
    for (const light of overhead.luminaires) {
      elements.push({
        id: nextId('I'), sourceId: light.id, type: `luminaria ${light.kind}`, name: 'Luminaria aceptada',
        level: levelName, position: light.positionM,
        dimensions: { height: light.bodyHeightM, drop: light.dropM, ceilingHeight: light.ceilingHeightM },
        attributes: { color: light.color, temperatureK: light.temperatureK, lumens: light.lumens, enabled: light.enabled },
        relationships: ['Anclada al techo de su estancia; conserva su soporte.'],
      });
    }

    for (const wall of source.walls) {
      const path = wallPath(source, wall);
      const lengthMm = path.length;
      const baseMm = wall.baseElevationMm ?? 0;
      const heightMm = wall.heightMm ?? 2700;
      elements.push({
        id: nextId('W'), sourceId: wall.id, type: wall.hidden ? 'límite de estancia oculto' : 'muro',
        name: wall.name ?? `Muro ${wall.id}`, level: levelName,
        dimensions: { length: meters(lengthMm), thickness: meters(wall.thicknessMm), height: meters(heightMm), baseElevation: meters(baseMm) },
        areaM2: area(lengthMm * heightMm),
        relationships: source.openings.filter((opening) => opening.wallId === wall.id)
          .map((opening) => `Contiene abertura ${opening.id}.`),
      });
    }

    for (const opening of source.openings) {
      elements.push({
        id: nextId('O'), sourceId: opening.id, type: opening.kind, name: opening.name ?? `${opening.kind} ${opening.id}`,
        level: levelName,
        dimensions: { width: meters(opening.widthMm), height: meters(opening.heightMm ?? 2100), elevation: meters(opening.elevationMm ?? 0) },
        relationships: [`Abertura en muro ${opening.wallId}; posición longitudinal ${(opening.position * 100).toFixed(1)}%.`],
      });
    }

    for (const b of boundaryDesignContext(source)) {
      const boundaryId = nextId('cerramiento');
      elements.push({ id: boundaryId, sourceId: b.id, type: 'boundary', name: b.name, level: levelName,
        boundary: b.endpointsM, dimensions: { length: b.lengthM, thickness: b.thicknessM, height: b.heightM, baseHeight: b.baseHeightM, upperHeight: b.upperHeightM },
        attributes: { infill: b.infill, postShape: b.postShape, postSize: b.postSizeM, postSpacing: b.postSpacingM, baseColor: b.baseColor, infillColor: b.infillColor, postColor: b.postColor } });
      for (const g of b.gates) elements.push({ id: nextId('puerta-exterior'), sourceId: g.id, type: 'boundary-gate', name: 'Puerta peatonal exterior', level: levelName,
        dimensions: { width: g.widthM, height: g.heightM, positionAlongBoundary: g.positionM },
        attributes: { hinge: g.hinge, openAngleDeg: g.openAngleDeg, color: g.color }, relationships: [boundaryId] });
    }
    for (const column of source.columns ?? []) {
      elements.push({
        id: nextId('C'), sourceId: column.id, type: 'columna', name: column.name ?? `Columna ${column.id}`, level: levelName,
        position: { x: meters(column.x), y: meters(column.y), elevation: meters(column.elevationMm) }, rotationDeg: degrees(column.rotation),
        dimensions: { width: meters(column.widthMm), depth: meters(column.depthMm), height: meters(column.heightMm) },
        areaM2: area(column.widthMm * column.depthMm),
      });
    }

    for (const stair of source.stairs ?? []) {
      elements.push({
        id: nextId('S'), sourceId: stair.id, type: `escalera ${stair.kind}`, name: stair.name ?? `Escalera ${stair.id}`, level: levelName,
        position: { x: meters(stair.x), y: meters(stair.y), elevation: meters(stair.elevationMm) }, rotationDeg: degrees(stair.rotation),
        dimensions: { width: meters(stair.widthMm), development: meters(stair.depthMm), rise: meters(stair.heightMm), startElevation: meters(stair.elevationMm), arrivalElevation: meters(stair.elevationMm + stair.heightMm) },
        areaM2: area(stair.widthMm * stair.depthMm),
        attributes: {
          'acabado de huellas': surfaceMaterial(stair.materialId)?.label ?? stair.materialId,
          ...(stair.bodyMaterialId ? { 'acabado de contrahuellas, laterales y cara inferior': surfaceMaterial(stair.bodyMaterialId)?.label ?? stair.bodyMaterialId } : {}),
        },
        relationships: [`Recorrido único de ${stair.stepCount} peldaños; conserva su posición y dirección.`],
      });
    }

    for (const ramp of source.ramps ?? []) {
      if (isRampLanding(ramp)) {
        elements.push({
          id: nextId('L'), sourceId: ramp.id, type: 'descansillo independiente', name: ramp.name ?? `Descansillo ${ramp.id}`, level: levelName,
          position: { x: meters(ramp.x), y: meters(ramp.y), elevation: meters(ramp.elevationMm) }, rotationDeg: degrees(ramp.rotation),
          dimensions: { width: meters(ramp.widthMm), depth: meters(ramp.depthMm), elevation: meters(ramp.elevationMm) },
          areaM2: area(ramp.widthMm * ramp.depthMm),
          attributes: {
            'acabado transitable': surfaceMaterial(ramp.materialId)?.label ?? ramp.materialId,
            ...(ramp.bodyMaterialId ? { 'acabado del canto y cara inferior': surfaceMaterial(ramp.bodyMaterialId)?.label ?? ramp.bodyMaterialId } : {}),
          },
          relationships: ['Plataforma horizontal maciza desde la cota base hasta su cota de acabado.'],
        });
        continue;
      }
      const id = nextId('R');
      const parts = rampParts(ramp);
      const flights = parts.filter((part) => part.kind === 'flight');
      const landing = parts.find((part) => part.kind === 'landing');
      const developmentMm = flights.reduce((sum, part) => sum + part.depthMm, 0);
      const totalRiseMm = flights.reduce((sum, part) => sum + part.riseMm, 0);
      elements.push({
        id, sourceId: ramp.id, type: 'rampa', name: ramp.name ?? `Rampa ${ramp.id}`, level: levelName,
        position: { x: meters(ramp.x), y: meters(ramp.y), elevation: meters(ramp.elevationMm) }, rotationDeg: degrees(ramp.rotation),
        dimensions: { width: meters(ramp.widthMm), development: meters(developmentMm), rise: meters(totalRiseMm), startElevation: meters(ramp.elevationMm), arrivalElevation: meters(ramp.elevationMm + totalRiseMm) },
        areaM2: area(ramp.widthMm * (developmentMm + (landing?.depthMm ?? 0))),
        attributes: {
          'acabado transitable': surfaceMaterial(ramp.materialId)?.label ?? ramp.materialId,
          ...(ramp.bodyMaterialId ? { 'acabado de laterales y cara inferior': surfaceMaterial(ramp.bodyMaterialId)?.label ?? ramp.bodyMaterialId } : {}),
        },
        relationships: [
          `EXISTE UNA SOLA ${id}: ${flights.length} tramo(s), del nivel ${meters(ramp.elevationMm)} m al ${meters(ramp.elevationMm + totalRiseMm)} m.`,
          ...(landing ? [`Descansillo integrado a ${meters(landing.elevationMm)} m; no crear otro descansillo ni otra rampa.`] : []),
          ...(ramp.route ? [`El tramo 2 gira a la ${ramp.route.turn}; conserva ese orden de circulación.`] : []),
        ],
      });
    }
  }

  const invariants = [
    BOUNDARY_RENDER_POLICY,
    'Los identificadores, cantidades, posiciones, cotas, áreas y relaciones son restricciones físicas; no se pueden interpretar ni sustituir.',
    'No crear, eliminar, duplicar, desplazar, girar ni intercambiar rampas, escaleras, descansillos, columnas, muros o huecos.',
    'Las áreas y las cotas son métricas obligatorias: no cambiar la superficie útil ni convertir un suelo elevado en terreno.',
    'Solo se permiten acabados, iluminación, vegetación y mobiliario no estructural que no invadan la circulación, subordinados a los permisos del render.',
    CEILING_RENDER_POLICY,
  ];
  const totals = {
    finishedFloorAreaM2: Number(elements.filter((element) => element.type === 'suelo acabado')
      .reduce((sum, element) => sum + (element.areaM2 ?? 0), 0).toFixed(2)),
  };
  const auditPrompt = renderContractPrompt(elements, totals, invariants);
  return {
    format: 'habiteka-render-contract-v1', units: 'm', spaceKind: doc.designSpaceKind ?? null,
    elements, totals, invariants, auditPrompt,
    prompt: modelRenderPrompt(elements, totals, invariants),
  };
}

function renderContractPrompt(
  elements: RenderContractElement[],
  totals: EditorRenderContract['totals'],
  invariants: string[],
): string {
  const rows = elements.map((element) => {
    const dimensions = Object.entries(element.dimensions ?? {}).map(([key, value]) => `${key}=${value}m`).join(', ');
    const position = element.position ? ` pos=(${element.position.x},${element.position.y},${element.position.elevation})m` : '';
    const rotation = element.rotationDeg === undefined ? '' : ` giro=${element.rotationDeg}°`;
    const areaText = element.areaM2 === undefined ? '' : ` área=${element.areaM2}m²`;
    const relations = element.relationships?.length ? ` relación=${element.relationships.join(' ')}` : '';
    const physical = physicalDetails(element);
    return `${element.id} | ${element.type} | ${element.name}.${position}${rotation} ${dimensions}${areaText}.${relations}${physical}`;
  });
  return [
    'CONTRATO ESTRUCTURAL INALTERABLE DEL RENDER. Cada fila es un elemento real; conserva exactamente sus datos.',
    `SUPERFICIE TOTAL DE SUELOS ACABADOS: ${totals.finishedFloorAreaM2}m². No la alteres.`,
    ...invariants.map((value) => `REGLA: ${value}`),
    'ELEMENTOS:',
    ...rows,
  ].join('\n');
}

/** El generador recibe todas las magnitudes, pero ningún identificador imprimible. */
function modelRenderPrompt(
  elements: RenderContractElement[],
  totals: EditorRenderContract['totals'],
  invariants: string[],
): string {
  const rows = elements.map((element, index) => {
    const dimensions = Object.entries(element.dimensions ?? {})
      .map(([key, value]) => `${humanDimension(key)} ${value} metros`).join(', ');
    const position = element.position
      ? ` posición X ${element.position.x}, Y ${element.position.y}, cota ${element.position.elevation} metros.` : '';
    const rotation = element.rotationDeg === undefined ? '' : ` orientación ${element.rotationDeg} grados.`;
    const surface = element.areaM2 === undefined ? '' : ` superficie ${element.areaM2} metros cuadrados.`;
    const relationships = element.relationships?.join(' ') ?? '';
    const physical = physicalDetails(element);
    return `Elemento estructural ${index + 1}: ${element.type}.${position}${rotation} ${dimensions}.${surface} ${relationships}${physical}`;
  });
  return [
    'RESTRICCIONES GEOMÉTRICAS INVISIBLES. Aplica todos estos datos físicamente, pero no dibujes texto, números, cotas, nombres, etiquetas ni símbolos.',
    `La superficie total de suelos acabados es ${totals.finishedFloorAreaM2} metros cuadrados y debe mantenerse.`,
    ...invariants,
    ...rows,
    'El resultado final es una fotografía arquitectónica limpia: no muestres ninguna información técnica usada para construirlo.',
  ].join('\n');
}

function humanDimension(key: string): string {
  return ({ width: 'ancho', depth: 'fondo', length: 'longitud', development: 'desarrollo', rise: 'desnivel', height: 'altura', perimeter: 'perímetro', finishedElevation: 'cota acabada', undersideElevation: 'cota inferior', slabDepth: 'grosor de forjado', startElevation: 'cota inicial', arrivalElevation: 'cota final', elevation: 'cota', drop: 'descenso', ceilingHeight: 'cota de techo' } as Record<string, string>)[key] ?? key;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function physicalDetails(element: RenderContractElement): string {
  const boundary = element.boundary?.length
    ? ` Contorno en metros: ${element.boundary.map((point) => `(${point.x},${point.y})`).join('; ')}.` : '';
  const attributes = element.attributes
    ? ` Propiedades: ${Object.entries(element.attributes).map(([key, value]) => `${key}=${value}`).join(', ')}.` : '';
  return boundary + attributes;
}
