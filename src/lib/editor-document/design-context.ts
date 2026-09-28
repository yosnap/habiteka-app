import { boundaryDesignContext, BOUNDARY_RENDER_POLICY } from './boundary-context';
import { surfaceMaterial } from './surface-materials';
import type { EditorDocument } from './schema';
import { buildingDocuments } from './building-levels';
import { deriveRooms } from './rooms';
import { wallPath } from './wall-path';
import { floorFinish, floorSlabThicknessMm } from './floor-finishes';
import { ceilingDesignContext, CEILING_RENDER_POLICY } from './ceiling-design-context';
import { wallConstruction } from './construction-properties';
import { designMaterialPalette } from './design-material-palette';
import { buildingDesignStyle } from './design-scope';

const meters = (millimeters: number) => Number((millimeters / 1000).toFixed(3));

/**
 * Contrato compacto y legible para el modelo de diseño. Conserva la geometría que
 * no puede variar en un render; no es un prompt editable ni una conversión al
 * formato del canvas antiguo.
 */
export function editorDesignContext(doc: EditorDocument) {
  return {
    format: 'habiteka-editor-design-context-v1',
    units: 'm',
    spaceKind: doc.designSpaceKind ?? null,
    designStyle: buildingDesignStyle(doc) ?? null,
    existingMaterialPalette: designMaterialPalette(doc),
    instruction: [
      'Geometría de referencia del plano editado por el usuario.',
      'Las cotas, alturas, elevaciones y dimensiones son restricciones físicas no negociables.',
      'Mantén muros, huecos, columnas y pilares exactamente donde están, con su sección, cota base y altura vertical indicadas.',
      'Mantén cada escalera, rampa y descansillo como un recorrido continuo: conserva su inicio, pendiente, giro, descansillos, cotas de llegada y circulación.',
      'La colección floors representa suelos acabados y forjados: una cota de suelo mayor que cero es una plataforma elevada a la que deben llegar sus rampas y escaleras.',
      'Cada slabUnderside describe el material visible del canto y de la cara inferior del forjado elevado; conserva el acabado existente salvo que la propuesta lo cambie expresamente.',
      'No aplanes, ocultes, flotes ni interrumpas rampas, descansillos, pilares o columnas; no inventes soportes ni cierres pasos existentes.',
      'Los delimitadores outdoor: y hidden: son límites de áreas abiertas, no construyas muros ni techos sobre ellos. Conserva patios, jardines y terrazas abiertos salvo las pérgolas o toldos explícitos del catálogo.',
      'Solo puedes proponer acabados, iluminación, mobiliario complementario y decoración.',
      CEILING_RENDER_POLICY, BOUNDARY_RENDER_POLICY,
    ].join(' '),
    levels: buildingDocuments(doc).map((level) => {
      const source = level.document;
      let rooms: ReturnType<typeof deriveRooms> = [];
      try {
        rooms = deriveRooms(source);
      } catch {
        /* Se conserva la geometría aunque falte cerrar una sala. */
      }
      const floors = rooms.map((room) => {
        const finish = floorFinish(source, room.id);
        const finishedElevationMm = finish.elevationMm ?? 0;
        const structuralDepthMm = floorSlabThicknessMm(finish);
        return {
          roomId: room.id,
          surface: { texture: finish.texture, material: surfaceMaterial(finish.texture)?.label ?? finish.texture,
            color: finish.color, tileSizeM: meters(finish.tileSizeMm), rotation: finish.rotation },
          slabUnderside: finishedElevationMm > 0 ? {
            texture: finish.undersideTexture ?? 'none',
            material: surfaceMaterial(finish.undersideTexture)?.label ?? 'sin textura',
            color: finish.undersideColor ?? '#756f66',
          } : null,
          finishedFloorElevationM: meters(finishedElevationMm),
          structuralDepthM: meters(structuralDepthMm),
          undersideElevationM: meters(Math.max(0, finishedElevationMm - structuralDepthMm)),
          boundaryM: room.boundary.map((point) => ({ x: meters(point.x), y: meters(point.y) })),
          requirement:
            finishedElevationMm > 0
              ? 'Plataforma elevada: rampas y escaleras deben llegar a este suelo acabado, no al terreno.'
              : 'Suelo a cota de la planta.',
        };
      });
      return {
        id: level.id,
        designStyle: source.designStyle ?? null,
        elevationM: meters(level.elevationMm),
        rooms: rooms.map((room) => ({
          id: room.id,
          areaM2: Number((room.areaMm2 / 1_000_000).toFixed(2)),
          boundaryM: room.boundary.map((point) => ({ x: meters(point.x), y: meters(point.y) })),
        })),
        floors,
        boundaries: boundaryDesignContext(source),
        ...ceilingDesignContext(source),
        walls: source.walls.map((wall) => {
          const path = wallPath(source, wall);
          const materials = wallConstruction(wall).materials;
          return {
            id: wall.id,
            name: wall.name ?? null,
            hidden: Boolean(wall.hidden),
            lengthM: meters(path.length),
            thicknessM: meters(wall.thicknessMm),
            heightM: meters(wall.heightMm ?? 2700),
            baseElevationM: meters(wall.baseElevationMm ?? 0),
            finishes: {
              left: { materialId: materials.left, color: wall.colors?.left ?? null },
              right: { materialId: materials.right, color: wall.colors?.right ?? null },
            },
            pathM: path.samples().map((point) => ({ x: meters(point.x), y: meters(point.y) })),
          };
        }),
        openings: source.openings.map((opening) => ({
          id: opening.id,
          name: opening.name ?? null,
          wallId: opening.wallId,
          kind: opening.kind,
          position: Number(opening.position.toFixed(4)),
          widthM: meters(opening.widthMm),
          heightM: meters(opening.heightMm ?? 2100),
          elevationM: meters(opening.elevationMm ?? 0),
        })),
        columns: (source.columns ?? []).map((column) => ({
          id: column.id,
          name: column.name ?? null,
          positionM: {
            x: meters(column.x),
            y: meters(column.y),
            elevation: meters(column.elevationMm),
          },
          dimensionsM: {
            width: meters(column.widthMm),
            depth: meters(column.depthMm),
            height: meters(column.heightMm),
          },
          rotationDeg: column.rotation,
        })),
        stairs: (source.stairs ?? []).map((stair) => ({
          id: stair.id,
          name: stair.name ?? null,
          kind: stair.kind,
          positionM: {
            x: meters(stair.x),
            y: meters(stair.y),
            elevation: meters(stair.elevationMm),
          },
          dimensionsM: {
            width: meters(stair.widthMm),
            depth: meters(stair.depthMm),
            height: meters(stair.heightMm),
          },
          rotationDeg: stair.rotation,
          stepCount: stair.stepCount,
          elevationProfileM: {
            start: meters(stair.elevationMm),
            arrival: meters(stair.elevationMm + stair.heightMm),
          },
        })),
        ramps: (source.ramps ?? []).map((ramp) => ({
          id: ramp.id,
          name: ramp.name ?? null,
          positionM: { x: meters(ramp.x), y: meters(ramp.y), elevation: meters(ramp.elevationMm) },
          dimensionsM: {
            width: meters(ramp.widthMm),
            depth: meters(ramp.depthMm),
            rise: meters(ramp.riseMm),
          },
          rotationDeg: ramp.rotation,
          ...(ramp.bodyMaterialId ? { bodyFinish: surfaceMaterial(ramp.bodyMaterialId)?.label ?? ramp.bodyMaterialId } : {}),
          elevationProfileM: {
            start: meters(ramp.elevationMm),
            firstArrival: meters(ramp.elevationMm + ramp.riseMm),
            finalArrival: meters(ramp.elevationMm + ramp.riseMm + (ramp.route?.secondRiseMm ?? 0)),
          },
          route: ramp.route
            ? {
                landingM: meters(ramp.route.landingMm),
                turn: ramp.route.turn,
                secondDepthM: meters(ramp.route.secondDepthMm),
                secondRiseM: meters(ramp.route.secondRiseMm),
              }
            : null,
        })),
        furniture: source.furniture.map((item) => ({
          id: item.id,
          name: item.name ?? null,
          kind: item.kind,
          catalogId: item.catalogId ?? null,
          positionM: {
            x: meters(item.x),
            y: meters(item.y),
            elevation: meters(item.elevationMm ?? 0),
          },
          dimensionsM: {
            width: meters(item.widthMm),
            depth: meters(item.depthMm),
            height: meters(item.heightMm ?? 0),
          },
          rotationDeg: item.rotation,
          color: item.color ?? null,
        })),
      };
    }),
  };
}

/**
 * El contexto viaja dentro del prompt de modelos de imagen, cuya cuota suele ser
 * mucho menor que la de un modelo de texto. No necesitamos sangría humana: las
 * dos referencias rasterizadas ya contienen el detalle gráfico de la planta.
 */
export const serializeEditorDesignContext = (doc: EditorDocument) =>
  JSON.stringify(editorDesignContext(doc));
