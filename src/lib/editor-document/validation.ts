import { assertBoundaryFields } from './boundary-validation';
import { geographicSiteSchema } from './geographic-site';
import { propertyOrientationSchema } from './property-orientation';
import { renderBackdropSchema } from './render-backdrop';
import { exteriorRoofSchema } from './exterior-roof';
import { isValidEstilo } from '@/lib/design-options';
import { assertKitchenRunFields } from './kitchen-run-validation';
import { assertWalkthroughFields } from './walkthrough-validation';
import type { EditorDocument } from './schema';
import { assertCeilingFields } from './ceiling-validation';
import { assertLightStripFields } from './light-strip-validation';
import { assertLightingSceneFields } from './lighting-scene-validation';
import { assertLightZoneFields } from './light-zone-validation';
import { assertDesignZoneFields } from './design-zone-validation';
import { surfaceMaterial } from './surface-materials';
import { isDoorHandle, isFrameFinish, isLeafDesign, isLeafFinish } from './opening-look-options';
import { distance, EPSILON, wallPoints } from './geometry';
import { assertPlanarTopology } from './topology';
import { isDesignSpaceKind } from '@/lib/design-space-kind';
import { wallPath } from './wall-path';

function record(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Entidad inválida');
}
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Texto o ID inválido');
}
function finite(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('Coordenada o dimensión no finita');
}
function positive(value: unknown): void {
  finite(value);
  if (value <= 0) throw new Error('Dimensión no positiva');
}
function point(value: unknown): void {
  record(value);
  finite(value.x);
  finite(value.y);
}
function origin(value: unknown): void {
  if (value !== 'raster' && value !== 'physical')
    throw new Error('Procedencia dimensional desconocida');
}
function keys(value: Record<string, unknown>, allowed: string): void {
  if (Object.keys(value).some((key) => !allowed.split(' ').includes(key)))
    throw new Error('Campo desconocido');
}
function nonnegative(value: unknown): void {
  finite(value);
  if (value < 0) throw new Error('Elevación negativa');
}
function color(value: unknown): void {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
    throw new Error('Color inválido');
}

export function assertEditorDocument(value: unknown): asserts value is EditorDocument {
  record(value);
  if (![2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(value.schemaVersion as number) || value.units !== 'mm')
    throw new Error('Versión o unidades no compatibles');
  const construction = (value.schemaVersion as number) >= 3,
    spatial = (value.schemaVersion as number) >= 4,
    ramps = (value.schemaVersion as number) >= 6;
  const designSpace = (value.schemaVersion as number) >= 7;
  keys(
    value,
    `schemaVersion revision units calibration importReview vertices walls openings furniture dimensions labels terrainSurfaces designStyle designZones geographicSite propertyOrientation exteriorRoof renderBackdrop${construction ? ' stairs' : ''}${ramps ? ' ramps columns' : ''}${spatial ? ' comments' : ''}${(value.schemaVersion as number) >= 5 ? ' floorFinishes levels activeLevelId' : ''}${designSpace ? ' designSpaceKind' : ''}${(value.schemaVersion as number) >= 8 ? ' ceilings luminaires' : ''}${(value.schemaVersion as number) >= 9 ? ' walkthroughs' : ''}${(value.schemaVersion as number) >= 10 ? ' boundaries' : ''}${(value.schemaVersion as number) >= 11 ? ' kitchenRuns' : ''}${(value.schemaVersion as number) >= 12 ? ' lightStrips lightingScenes lightZones' : ''}`,
  );
  if (value.propertyOrientation !== undefined) propertyOrientationSchema.parse(value.propertyOrientation);
  if (value.geographicSite !== undefined) geographicSiteSchema.parse(value.geographicSite);
  if (value.renderBackdrop !== undefined) renderBackdropSchema.parse(value.renderBackdrop);
  if (value.exteriorRoof !== undefined) exteriorRoofSchema.parse(value.exteriorRoof);
  if (value.terrainSurfaces !== undefined) {
    if (!Array.isArray(value.terrainSurfaces) || value.terrainSurfaces.length > 40)
      throw new Error('Superficies de terreno inválidas');
    const terrainIds = new Set<string>();
    for (const surface of value.terrainSurfaces) {
      record(surface);
      keys(surface, 'id name x y widthMm depthMm texture color tileSizeMm rotation');
      text(surface.id); text(surface.name);
      if (terrainIds.has(surface.id)) throw new Error('Terreno duplicado');
      terrainIds.add(surface.id);
      if ((surface.name as string).length > 100) throw new Error('Nombre de terreno demasiado largo');
      finite(surface.x); finite(surface.y); positive(surface.widthMm); positive(surface.depthMm);
      if ((surface.widthMm as number) > 200000 || (surface.depthMm as number) > 200000)
        throw new Error('El terreno no puede superar 200 m por lado');
      color(surface.color); positive(surface.tileSizeMm); finite(surface.rotation);
      if ((surface.tileSizeMm as number) < 50 || (surface.tileSizeMm as number) > 10000)
        throw new Error('Escala de terreno fuera de rango');
      if (!['none', 'wood', 'tile'].includes(surface.texture as string) && !surfaceMaterial(surface.texture as string))
        throw new Error('Textura de terreno desconocida');
    }
  }
  if (value.importReview !== undefined) {
    record(value.importReview);
    keys(value.importReview, 'geometryFingerprint reasons');
    text(value.importReview.geometryFingerprint);
    if (!/^[a-f0-9]{64}$/.test(value.importReview.geometryFingerprint as string) ||
        !Array.isArray(value.importReview.reasons) || value.importReview.reasons.length > 5)
      throw new Error('Revisión de importación inválida');
    for (const reason of value.importReview.reasons) {
      text(reason);
      if ((reason as string).length > 500) throw new Error('Motivo de importación demasiado largo');
    }
  }
  if (
    designSpace &&
    value.designSpaceKind !== undefined &&
    !isDesignSpaceKind(value.designSpaceKind)
  )
    throw new Error('Tipo de espacio desconocido');
  if (value.designStyle !== undefined && !isValidEstilo(value.designStyle))
    throw new Error('Estilo de diseño desconocido');
  if (value.levels !== undefined || value.activeLevelId !== undefined) {
    text(value.activeLevelId);
    if (!Array.isArray(value.levels) || !value.levels.length || value.levels.length > 20)
      throw new Error('Número de plantas inválido (1–20)');
    const levelIds = new Set<string>();
    for (const level of value.levels) {
      record(level);
      keys(level, 'id name heightMm document');
      text(level.id);
      text(level.name);
      positive(level.heightMm);
      if (levelIds.has(level.id)) throw new Error('Planta duplicada');
      if (
        (level.name as string).length > 80 ||
        (level.heightMm as number) < 500 ||
        (level.heightMm as number) > 20000
      )
        throw new Error('Nombre o altura de planta inválidos');
      levelIds.add(level.id);
      if (level.id === value.activeLevelId) {
        if (level.document !== undefined)
          throw new Error('La planta activa no puede duplicar su documento');
      } else {
        record(level.document);
        if (level.document.levels !== undefined || level.document.activeLevelId !== undefined)
          throw new Error('No se admiten plantas anidadas');
        assertEditorDocument(level.document);
      }
    }
    if (!levelIds.has(value.activeLevelId)) throw new Error('Planta activa inexistente');
  }
  if ((value.schemaVersion as number) >= 5) {
    if (!Array.isArray(value.floorFinishes)) throw new Error('Acabados de suelo inválidos');
    const rooms = new Set<string>();
    for (const finish of value.floorFinishes) {
      record(finish);
      keys(
        finish,
        'roomId color texture tileSizeMm rotation elevationMm slabThicknessMm undersideColor undersideTexture',
      );
      text(finish.roomId);
      if (!finish.roomId.startsWith('room:')) throw new Error('Identidad de habitación inválida');
      let boundary: unknown;
      try {
        boundary = JSON.parse(finish.roomId.slice(5));
      } catch {
        throw new Error('Identidad de habitación inválida');
      }
      if (
        !Array.isArray(boundary) ||
        boundary.length < 3 ||
        boundary.some((id) => typeof id !== 'string' || !id)
      )
        throw new Error('Identidad de habitación inválida');
      if (rooms.has(finish.roomId)) throw new Error('Acabado de suelo duplicado');
      rooms.add(finish.roomId);
      color(finish.color);
      positive(finish.tileSizeMm);
      finite(finish.rotation);
      if (finish.elevationMm !== undefined) nonnegative(finish.elevationMm);
      if (finish.slabThicknessMm !== undefined) {
        positive(finish.slabThicknessMm);
        if ((finish.slabThicknessMm as number) > ((finish.elevationMm as number) ?? 0))
          throw new Error('El grosor del forjado supera su cota');
      }
      if (finish.undersideColor !== undefined) color(finish.undersideColor);
      if (
        !['none', 'wood', 'tile'].includes(finish.texture as string) &&
        !surfaceMaterial(finish.texture as string)
      )
        throw new Error('Textura de suelo desconocida');
      if (
        finish.undersideTexture !== undefined &&
        !['none', 'wood', 'tile'].includes(finish.undersideTexture as string) &&
        !surfaceMaterial(finish.undersideTexture as string)
      )
        throw new Error('Textura inferior desconocida');
      if ((finish.tileSizeMm as number) < 50 || (finish.tileSizeMm as number) > 10000)
        throw new Error('Escala de textura fuera de rango');
    }
  }
  finite(value.revision);
  if (!Number.isSafeInteger(value.revision) || value.revision < 0)
    throw new Error('Revisión inválida');
  if (value.calibration !== null) {
    record(value.calibration);
    keys(value.calibration, 'mmPerPixel');
    positive(value.calibration.mmPerPixel);
  }
  const ids = new Set<string>();
  for (const surface of value.terrainSurfaces ?? []) ids.add(surface.id);
  for (const key of [
    'vertices',
    'walls',
    'openings',
    'furniture',
    'dimensions',
    'labels',
    ...(construction ? ['stairs'] : []),
    ...(ramps ? ['ramps'] : []),
    ...(value.columns ? ['columns'] : []),
    ...(spatial ? ['comments'] : []),
  ]) {
    const entities = value[key];
    if (!Array.isArray(entities)) throw new Error(`Colección inválida: ${key}`);
    if (key === 'comments' && entities.length > 500) throw new Error('Máximo 500 comentarios');
    for (const e of entities) {
      record(e);
      text(e.id);
      if (ids.has(e.id)) throw new Error('ID duplicado');
      ids.add(e.id);
      const allowed: Record<string, string> = {
        vertices: 'id x y',
        walls: 'id name hidden classification startVertexId endVertexId thicknessMm dimensionalOrigin',
        openings: 'id name wallId kind position widthMm dimensionalOrigin',
        furniture: 'id name x y kind catalogId widthMm depthMm rotation dimensionalOrigin',
        dimensions: 'id from to label',
        labels: 'id x y text',
        stairs:
          'id name x y kind catalogId widthMm depthMm heightMm elevationMm rotation stepCount materialId bodyMaterialId railingLeft railingRight',
        ramps:
          'id name x y catalogId widthMm depthMm riseMm elevationMm rotation materialId bodyMaterialId route railingLeft railingRight',
        columns:
          'id name x y catalogId widthMm depthMm heightMm elevationMm rotation materialId color',
        comments: 'id targetEntityId anchor text',
      };
      if (construction && key === 'walls') allowed.walls += ' heightMm materials baseElevationMm';
      if ((value.schemaVersion as number) >= 5 && key === 'walls')
        allowed.walls += ' curveHeightMm';
      if (construction && key === 'openings')
        allowed.openings += ' heightMm elevationMm catalogId hinge swing openAngleDeg sourceRampId leafDesign leafFinish handle frameFinish';
      if (spatial) {
        allowed.walls += ' colors';
        allowed.openings += ' colors';
        allowed.stairs += ' color';
        allowed.ramps += ' color';
        allowed.furniture += ' heightMm elevationMm color hostId coverage rolledSides porchSteps';
      }
      keys(e, allowed[key]!);
      if (e.name !== undefined) {
        text(e.name);
        if ((e.name as string).length > 100) throw new Error('Nombre de elemento demasiado largo');
      }
      if (spatial && (key === 'walls' || key === 'openings')) {
        record(e.colors);
        const faces = key === 'walls' ? ['left', 'right'] : ['frame', 'leaf'];
        keys(e.colors, faces.join(' '));
        faces.forEach((face) => color((e.colors as Record<string, unknown>)[face]));
      }
      if (spatial && (key === 'furniture' || key === 'stairs' || key === 'ramps')) color(e.color);
      if (spatial && key === 'furniture') {
        positive(e.heightMm);
        nonnegative(e.elevationMm);
        if (e.hostId !== undefined) text(e.hostId);
        if (e.porchSteps !== undefined && (e.kind !== 'porche-entrada' || typeof e.porchSteps !== 'boolean'))
          throw new Error('Peldaños de porche inválidos');
        if (e.coverage !== undefined) { finite(e.coverage); if ((e.coverage as number) < 0 || (e.coverage as number) > 1) throw new Error('La cobertura va de 0 a 1'); }
        if (e.rolledSides !== undefined && (e.kind !== 'carpa' || !['none', 'left', 'right', 'both'].includes(e.rolledSides as string)))
          throw new Error('Laterales de carpa inválidos');
      }
      if (key === 'comments') {
        text(e.targetEntityId);
        text(e.text);
        if ((e.text as string).length > 2000)
          throw new Error('Máximo 2000 caracteres por comentario');
        point(e.anchor);
        keys(e.anchor as Record<string, unknown>, 'x y');
        const anchor = e.anchor as { x: number; y: number };
        if ([anchor.x, anchor.y].some((n) => n < 0 || n > 1)) throw new Error('Ancla inválida');
      }
      if (key === 'vertices' || key === 'furniture' || key === 'labels') point(e);
      if (key === 'walls') {
        text(e.startVertexId);
        text(e.endVertexId);
        if (e.hidden !== undefined && typeof e.hidden !== 'boolean')
          throw new Error('Visibilidad de muro inválida');
        if (e.classification !== undefined && !['interior', 'exterior'].includes(e.classification as string))
          throw new Error('Clasificación de pared inválida');
        positive(e.thicknessMm);
        origin(e.dimensionalOrigin);
        if (e.baseElevationMm !== undefined) nonnegative(e.baseElevationMm);
        if (e.curveHeightMm !== undefined) finite(e.curveHeightMm);
        if (construction) {
          positive(e.heightMm);
          record(e.materials);
          keys(e.materials, 'left right');
          text(e.materials.left);
          text(e.materials.right);
        }
      } else if (key === 'openings') {
        text(e.wallId);
        finite(e.position);
        positive(e.widthMm);
        origin(e.dimensionalOrigin);
        text(e.kind);
        if (!['puerta', 'ventana', 'hueco'].includes(e.kind))
          throw new Error('Tipo de abertura desconocido');
        if (construction) {
          positive(e.heightMm);
          nonnegative(e.elevationMm);
          text(e.catalogId);
          if (
            !['left', 'right'].includes(e.hinge as string) ||
            !['left', 'right'].includes(e.swing as string)
          )
            throw new Error('Orientación de abertura inválida');
          finite(e.openAngleDeg);
          if (e.openAngleDeg < 0 || e.openAngleDeg > 180)
            throw new Error('Ángulo de apertura inválido');
          if (e.sourceRampId !== undefined) text(e.sourceRampId);
          // Aspecto opcional: sin estos campos la puerta o ventana se ve como siempre.
          if ((e.leafDesign !== undefined && !isLeafDesign(e.leafDesign)) || (e.leafFinish !== undefined && !isLeafFinish(e.leafFinish))
            || (e.handle !== undefined && !isDoorHandle(e.handle)) || (e.frameFinish !== undefined && !isFrameFinish(e.frameFinish)))
            throw new Error('Diseño o acabado de abertura desconocido');
        }
      } else if (key === 'furniture') {
        text(e.kind);
        positive(e.widthMm);
        positive(e.depthMm);
        finite(e.rotation);
        origin(e.dimensionalOrigin);
        if (e.catalogId !== undefined) text(e.catalogId);
      } else if (key === 'dimensions') {
        point(e.from);
        point(e.to);
        keys(e.from as Record<string, unknown>, 'x y');
        keys(e.to as Record<string, unknown>, 'x y');
        if (e.label !== undefined) text(e.label);
      } else if (key === 'labels') text(e.text);
      else if (key === 'stairs') {
        point(e);
        text(e.catalogId);
        text(e.materialId);
        if (e.bodyMaterialId !== undefined && !surfaceMaterial(e.bodyMaterialId as string))
          throw new Error('Acabado del cuerpo de la escalera inválido');
        if (!['straight', 'L', 'U'].includes(e.kind as string))
          throw new Error('Escalera desconocida');
        positive(e.widthMm);
        positive(e.depthMm);
        positive(e.heightMm);
        nonnegative(e.elevationMm);
        finite(e.rotation);
        finite(e.stepCount);
        if (!Number.isInteger(e.stepCount) || e.stepCount < 3 || e.stepCount > 128)
          throw new Error('Número de peldaños inválido');
        if (e.kind === 'U' && (e.depthMm as number) <= (e.widthMm as number) / 2)
          throw new Error('Fondo insuficiente para escalera U');
        if (e.railingLeft !== undefined && typeof e.railingLeft !== 'boolean')
          throw new Error('Pasamanos izquierdo inválido');
        if (e.railingRight !== undefined && typeof e.railingRight !== 'boolean')
          throw new Error('Pasamanos derecho inválido');
      } else if (key === 'ramps') {
        point(e);
        text(e.catalogId);
        text(e.materialId);
        if (e.bodyMaterialId !== undefined && !surfaceMaterial(e.bodyMaterialId as string))
          throw new Error('Acabado del cuerpo de la rampa inválido');
        positive(e.widthMm);
        positive(e.depthMm);
        nonnegative(e.riseMm);
        nonnegative(e.elevationMm);
        finite(e.rotation);
        if (e.riseMm === 0 && e.catalogId !== 'builtin:ramp-landing')
          throw new Error('Una rampa debe tener desnivel');
        if (e.railingLeft !== undefined && typeof e.railingLeft !== 'boolean')
          throw new Error('Pasamanos izquierdo inválido');
        if (e.railingRight !== undefined && typeof e.railingRight !== 'boolean')
          throw new Error('Pasamanos derecho inválido');
        if (e.route !== undefined) {
          record(e.route);
          keys(e.route, 'landingMm turn secondDepthMm secondRiseMm landingOffset secondOffset');
          positive(e.route.landingMm);
          positive(e.route.secondDepthMm);
          positive(e.route.secondRiseMm);
          for (const offset of [e.route.landingOffset, e.route.secondOffset])
            if (offset !== undefined) {
              point(offset);
              keys(offset as Record<string, unknown>, 'x y');
            }
          if (!['left', 'right', 'reverse'].includes(e.route.turn as string))
            throw new Error('Recorrido de rampa inválido');
        }
      } else if (key === 'columns') {
        point(e);
        text(e.catalogId);
        text(e.materialId);
        positive(e.widthMm);
        positive(e.depthMm);
        positive(e.heightMm);
        nonnegative(e.elevationMm);
        finite(e.rotation);
        if (e.catalogId !== 'builtin:column-rectangular') throw new Error('Columna desconocida');
        if (e.color !== undefined) color(e.color);
      }
    }
  }
  const version = value.schemaVersion as number;
  const ceilingScope = version >= 8 ? assertCeilingFields(value, ids, version) : undefined;
  if ((value.schemaVersion as number) >= 9) assertWalkthroughFields(value, ids);
  if ((value.schemaVersion as number) >= 10) assertBoundaryFields(value, ids);
  if ((value.schemaVersion as number) >= 11) assertKitchenRunFields(value, ids);
  if (version >= 12) {
    assertLightStripFields(value, ids, ceilingScope?.ceilingIds ?? new Set());
    assertLightingSceneFields(value, ids, ceilingScope?.lightIds ?? new Set());
    assertLightZoneFields(value, ids);
  }
  assertDesignZoneFields(value.designZones, ids);
  // All structural fields above are checked before accessing cross-entity geometry.
  const doc = value as unknown as EditorDocument;
  if (
    doc.comments?.some(
      (c) =>
        ![
          ...doc.walls,
          ...doc.openings,
          ...doc.furniture, ...(doc.boundaries ?? []), ...(doc.kitchenRuns ?? []),
          ...(doc.stairs ?? []),
          ...(doc.ramps ?? []),
          ...(doc.columns ?? []),
        ].some((e) => e.id === c.targetEntityId),
    )
  )
    throw new Error('Comentario sin elemento');
  for (const wall of doc.walls) {
    const [a, b] = wallPoints(doc, wall);
    if (!Number.isFinite(distance(a, b)) || distance(a, b) <= EPSILON)
      throw new Error('Muro degenerado');
    const path = wallPath(doc, wall);
    if (Math.abs(wall.curveHeightMm ?? 0) > path.chord / 2 || path.radius <= wall.thicknessMm / 2)
      throw new Error('Curvatura demasiado cerrada para el grosor del muro');
    const openings = doc.openings
      .filter((o) => o.wallId === wall.id)
      .sort((x, y) => x.position - y.position);
    let previousEnd = -Infinity;
    for (const opening of openings) {
      const openingTopMm = opening.heightMm! + opening.elevationMm!;
      const wallTopMm = (wall.baseElevationMm ?? 0) + wall.heightMm!;
      if (construction && openingTopMm > wallTopMm + EPSILON)
        throw new Error(
          `La ${opening.kind} llega a ${(openingTopMm / 1000).toFixed(2)} m, pero el muro llega a ${(wallTopMm / 1000).toFixed(2)} m.`,
        );
      const center = opening.position * path.length;
      const start = center - opening.widthMm / 2;
      const end = center + opening.widthMm / 2;
      if (start < -EPSILON || end > path.length + EPSILON)
        throw new Error('Abertura fuera del muro');
      if (start < previousEnd - EPSILON) throw new Error('Aberturas superpuestas');
      previousEnd = end;
    }
  }
  if (doc.openings.some((o) => !doc.walls.some((w) => w.id === o.wallId)))
    throw new Error('Abertura sin muro');
  if (
    doc.openings.some(
      (o) => o.sourceRampId && !doc.ramps?.some((ramp) => ramp.id === o.sourceRampId),
    )
  )
    throw new Error('Abertura automática sin rampa');
  assertPlanarTopology(doc);
}

export function parseEditorDocument(value: unknown): EditorDocument {
  assertEditorDocument(value);
  return structuredClone(value);
}
