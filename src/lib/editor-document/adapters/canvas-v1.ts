import { upgradeConstructionDocument } from '../migrations';
import { wizardWall } from './wizard-wall';
import { CATALOG_BY_KIND } from '@/canvas/catalog';
import { convert, list, numeric, point, record, string, unknownFields, vertexId } from './shared';
import type { EditorDocument, Point } from '../schema';

function addWall(doc: EditorDocument, id: string, from: Point, to: Point, thicknessMm: number) {
  doc.walls.push({ id, startVertexId: vertexId(doc, from), endVertexId: vertexId(doc, to),
    thicknessMm, dimensionalOrigin: 'raster' });
}

function opening(doc: EditorDocument, obj: Record<string, unknown>, factor: number) {
  const wallId = string(obj.parentId);
  const wall = doc.walls.find((w) => w.id === wallId);
  if (!wall) throw new Error('Abertura sin muro anclado; requiere corrección manual');
  const a = doc.vertices.find((v) => v.id === wall.startVertexId)!;
  const b = doc.vertices.find((v) => v.id === wall.endVertexId)!;
  const rotation = numeric(obj.rotation) * Math.PI / 180;
  const width = numeric(obj.width) * factor;
  const depth = numeric(obj.height) * factor;
  const x = numeric(obj.x) * factor + Math.cos(rotation) * width / 2 - Math.sin(rotation) * depth / 2;
  const y = numeric(obj.y) * factor + Math.sin(rotation) * width / 2 + Math.cos(rotation) * depth / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  if (Math.abs(Math.sin(rotation - Math.atan2(dy, dx))) > 1e-8) {
    throw new Error('Orientación de abertura no alineada con su muro');
  }
  if (Math.abs(dx * (y - a.y) - dy * (x - a.x)) / distance > wall.thicknessMm / 2 + 1) {
    throw new Error('Abertura fuera de su muro; requiere corrección manual');
  }
  doc.openings.push({ id: string(obj.id), wallId, kind: obj.kind === 'door' ? 'puerta' : 'ventana',
    position: ((x - a.x) * dx + (y - a.y) * dy) / (distance * distance),
    widthMm: width, dimensionalOrigin: 'raster' });
}

export function fromCanvasV1(raw: unknown, calibratedMmPerPixel?: number) {
  return convert(raw, (source, doc, issues) => {
    if (source.schemaVersion !== 1 || (source.version !== undefined && source.version !== 1 && source.version !== 2)) {
      throw new Error('Versión de canvas no soportada');
    }
    unknownFields(source, ['schemaVersion', 'version', 'walls', 'baseImage', 'strokes', 'objects',
      'products', 'selection', 'scale', 'ceilingHeightM', 'floorOutline', 'notes', 'rooms'], issues);
    if (source.scale) unknownFields(record(source.scale), ['pxPerMeter', 'ratio'], issues);
    const scale = source.scale ? numeric(record(source.scale).pxPerMeter) : null;
    const factor = calibratedMmPerPixel ?? (scale && scale > 0 ? 1000 / scale : null);
    if (!factor || !Number.isFinite(factor) || factor <= 0) throw new Error('Falta una escala válida para convertir el canvas');
    doc.calibration = { mmPerPixel: factor };
    // Estas capas no pueden omitirse durante una migración: conservar snapshot y bloquear activación.
    for (const key of ['strokes', 'products', 'floorOutline', 'rooms']) {
      if (source[key] !== undefined && source[key] !== null &&
        (!Array.isArray(source[key]) || source[key].length)) issues.push(`Capa ${key} requiere conversión adicional`);
    }
    if (source.baseImage) issues.push('Fondo requiere registrar asset y transformación antes de migrar');

    for (const rawWall of list(source.walls ?? [])) {
      const w = record(rawWall);
      unknownFields(w, ['id', 'p1', 'p2', 'thicknessPx'], issues);
      addWall(doc, string(w.id), point(w.p1, factor, issues), point(w.p2, factor, issues), numeric(w.thicknessPx) * factor);
    }
    const objects = list(source.objects).map(record);
    for (const obj of objects.filter((o) => o.kind === 'wall')) {
      const wizard = wizardWall(obj, factor, issues);
      if (wizard) {
        addWall(doc, string(obj.id), wizard.from, wizard.to, wizard.thicknessMm);
        continue;
      }
      const angle = numeric(obj.rotation) * Math.PI / 180;
      const width = numeric(obj.width) * factor, depth = numeric(obj.height) * factor;
      const from = { x: numeric(obj.x) * factor - Math.sin(angle) * depth / 2,
        y: numeric(obj.y) * factor + Math.cos(angle) * depth / 2 };
      addWall(doc, string(obj.id), from,
        { x: from.x + Math.cos(angle) * width, y: from.y + Math.sin(angle) * width }, depth);
    }
    for (const obj of objects) {
      unknownFields(obj, ['id', 'kind', 'x', 'y', 'width', 'height', 'rotation', 'parentId', 'catalogId', 'drawn', ...(obj.kind === 'wall' ? ['meta'] : [])], issues);
      if (obj.kind === 'wall') continue;
      if (obj.kind === 'door' || obj.kind === 'window') { opening(doc, obj, factor); continue; }
      const kind = string(obj.kind);
      if (!Object.hasOwn(CATALOG_BY_KIND, kind)) throw new Error(`Objeto no convertible: ${kind}`);
      doc.furniture.push({ id: string(obj.id), kind, x: numeric(obj.x) * factor, y: numeric(obj.y) * factor,
        widthMm: numeric(obj.width) * factor, depthMm: numeric(obj.height) * factor,
        rotation: numeric(obj.rotation), dimensionalOrigin: 'physical',
        ...(obj.catalogId ? { catalogId: string(obj.catalogId) } : {}) });
    }
    if (source.ceilingHeightM !== undefined) {
      const heightMm = numeric(source.ceilingHeightM) * 1000;
      if (heightMm <= 0) throw new Error('Altura de techo no válida');
      if (!doc.walls.length) issues.push('Altura de techo sin muros donde conservarla');
      Object.assign(doc, upgradeConstructionDocument(doc));
      doc.walls = doc.walls.map((wall) => ({ ...wall, heightMm }));
    }
    for (const rawNote of list(source.notes ?? [])) {
      const note = record(rawNote);
      unknownFields(note, ['id', 'x', 'y', 'text'], issues);
      doc.labels.push({ id: string(note.id), text: string(note.text), ...point(note, factor, issues, ['id', 'x', 'y', 'text']) });
    }
  });
}
