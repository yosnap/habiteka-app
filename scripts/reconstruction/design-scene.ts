/** Preparación local de un borrador; nunca publica ni acredita un diseño final. */
import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Path, Shape, ShapeGeometry, SphereGeometry, type BufferGeometry } from 'three';
import { z } from 'zod';
import type { EditorDocument } from '../../src/lib/editor-document/schema';
import { editorDocumentToScene } from '../../src/canvas/editor-v2/scene/editor-document-to-scene';
import { exteriorRoofGeometry } from '../../src/lib/editor-document/exterior-roof-geometry';
import { ceilingSurfaces } from '../../src/lib/editor-document/ceiling-geometry';
import { roofCeilingVoids } from '../../src/lib/editor-document/roof-opening-commands';
import { ceilingShapes } from '../../src/components/editor-v2/scene/ceiling-scene-utils';
import { surfaceMaterial } from '../../src/lib/editor-document/surface-materials';
import { createHipRoofGeometry } from '../../src/lib/editor-document/hip-roof-mesh';

const vector = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const material = z.object({ color, textureId: z.string().optional(), roughness: z.number().min(0).max(1).default(.7),
  glass: z.boolean().default(false), metalness: z.number().min(0).max(1).default(0), scaleM: z.number().positive().default(1) }).strict();
export const reconstructionSchema = z.object({
  purpose: z.literal('reconstruction-draft'),
  referenceIds: z.array(z.string().min(1)).min(1),
  materials: z.record(z.string(), material),
  defaults: z.object({ wall: z.string(), floor: z.string(), frame: z.string(), leaf: z.string(), roof: z.string(), roofFrame: z.string().optional(), glass: z.string() }).strict(),
  surfaces: z.array(z.object({ sourceId: z.string(), material: z.string(), referenceId: z.string(), evidence: z.string().min(10) }).strict()),
  objects: z.array(z.object({ id: z.string(), referenceId: z.string(), evidence: z.string().min(10),
    model: z.string().regex(/^\/(models)\/[a-zA-Z0-9_/-]+\.glb$/).optional(),
    shape: z.enum(['box', 'sphere', 'cylinder', 'fountain']).optional(), material: z.string().optional(),
    position: vector, size: vector.refine(value => value.every(n => n > 0)), rotation: z.number().finite().default(0),
    tint: color.optional(), tintMaterials: z.array(z.string()).optional(), frontRotation: z.number().finite().default(0),
  }).strict().refine(value => Boolean(value.model) !== Boolean(value.shape), 'Elige modelo o forma')
    .refine(value => !value.shape || Boolean(value.material), 'La forma necesita material')),
  unresolved: z.array(z.string()).min(1),
}).strict();
export type Reconstruction = z.infer<typeof reconstructionSchema>;
export interface DraftMesh { id: string; sourceId: string; vertices: number[]; triangles: number[]; material: string; }

export function validateReconstruction(raw: unknown, acceptedIds: string[]) {
  const design = reconstructionSchema.parse(raw), materials = new Set(Object.keys(design.materials));
  if (design.referenceIds.some(id => !acceptedIds.includes(id))) throw new Error('Referencia sin aceptación vigente.');
  for (const item of [...design.objects, ...design.surfaces]) {
    if (!design.referenceIds.includes(item.referenceId)) throw new Error('Falta vincular el elemento a un diseño aceptado.');
    if (item.material && !materials.has(item.material)) throw new Error('Material de reconstrucción desconocido.');
  }
  if (Object.values(design.defaults).some(id => !materials.has(id))) throw new Error('Falta un material de arquitectura.');
  if (new Set(design.objects.map(item => item.id)).size !== design.objects.length) throw new Error('Objeto de diseño duplicado.');
  return design;
}

export function reconstructionGeometry(document: EditorDocument, design: Reconstruction) {
  if (document.levels?.length || document.ramps?.length) throw new Error('Este borrador local todavía no exporta plantas adicionales ni rampas.');
  const scene = editorDocumentToScene(document);
  if (scene.warnings.length) throw new Error(scene.warnings.join(' '));
  const meshes: DraftMesh[] = [];
  const override = (id: string, fallback: string) => design.surfaces.find(item => item.sourceId === id)?.material ?? fallback;
  function mesh(id: string, sourceId: string, geometry: BufferGeometry, material: string) {
    const vertices = Array.from(geometry.getAttribute('position').array);
    const triangles = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: vertices.length / 3 }, (_, i) => i);
    meshes.push({ id, sourceId, vertices, triangles, material }); geometry.dispose();
  }
  // Ningún mueble del plano se incorpora implícitamente: el manifiesto define la apariencia.
  for (const box of scene.boxes.filter(item => item.role !== 'furniture')) {
    const geo = box.shape === 'cylinder' ? new CylinderGeometry(box.size[0] / 2, box.size[0] / 2, box.size[1], 24)
      : box.shape === 'ellipsoid' ? new SphereGeometry(.5, 24, 16).scale(...box.size) : new BoxGeometry(...box.size);
    geo.rotateY(box.rotation); geo.translate(...box.position);
    const role = box.role === 'glass' ? 'glass' : box.role === 'leaf' ? 'leaf' : ['frame', 'seal', 'rail'].includes(box.role) ? 'frame' : 'wall';
    mesh(box.id, box.sourceEntityId, geo, override(box.sourceEntityId, design.defaults[role]));
  }
  for (const polygon of scene.polygons) {
    const shape = new Shape();
    polygon.points.forEach((p, i) => i ? shape.lineTo(p.x, -p.y) : shape.moveTo(p.x, -p.y));
    shape.closePath();
    for (const ring of polygon.holes ?? []) {
      const hole = new Path(); ring.forEach((p, i) => i ? hole.lineTo(p.x, -p.y) : hole.moveTo(p.x, -p.y));
      hole.closePath(); shape.holes.push(hole);
    }
    const geo = polygon.height ? new ExtrudeGeometry(shape, { depth: polygon.height, bevelEnabled: false }) : new ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2); geo.translate(0, polygon.elevation, 0);
    mesh(polygon.id, polygon.sourceEntityId, geo, override(polygon.sourceEntityId, design.defaults[polygon.role === 'floor' ? 'floor' : 'wall']));
  }
  for (const [index, part] of exteriorRoofGeometry(document).entries()) {
    meshes.push({ id: `roof-${index}`, sourceId: part.openingId ?? 'exterior-roof', vertices: [...part.positions], triangles: [...part.indices],
      material: part.glazing ? design.defaults.glass : part.frame ? design.defaults.roofFrame ?? design.defaults.frame : design.defaults.roof });
    for (const [i, closure] of part.wallClosures.entries()) meshes.push({ id: `closure-${index}-${i}`, sourceId: closure.wallId,
      vertices: [...closure.positions], triangles: [...closure.indices], material: override(closure.wallId, design.defaults.wall) });
  }
  for (const surface of ceilingSurfaces(document)) {
    for (const [i, shape] of ceilingShapes(surface.room.boundary, roofCeilingVoids(document)).entries()) {
      const geo = new ExtrudeGeometry(shape, { depth: .04, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2); geo.translate(0, surface.heightMm / 1000, 0);
      mesh(`${surface.ceiling.id}:${i}`, surface.ceiling.id, geo, design.defaults.wall);
    }
  }
  // Mantener visibles los elementos arquitectónicos exteriores, con su geometría real.
  // Sus volúmenes no se sustituyen por muebles del catálogo.
  const structural = new Set([...document.furniture.filter(item => /:porche|:pergola|:toldo|:carpa/.test(item.catalogId ?? '')).map(item => item.id),
    ...(document.boundaries ?? []).map(item => item.id)]);
  for (const box of scene.boxes.filter(item => item.role === 'furniture' && structural.has(item.sourceEntityId))) {
    if (box.shape && !['box', 'rounded-box', 'cylinder', 'hip-roof', 'ellipsoid'].includes(box.shape)) throw new Error(`Cubierta exterior sin soporte: ${box.shape}`);
    const geo = box.shape === 'hip-roof' ? createHipRoofGeometry(...box.size)
      : box.shape === 'ellipsoid' ? new SphereGeometry(.5, 24, 16).scale(...box.size)
      : box.shape === 'cylinder' ? new CylinderGeometry(box.size[0] / 2, box.size[0] / 2, box.size[1], 24) : new BoxGeometry(...box.size);
    geo.rotateY(box.rotation); geo.translate(...box.position);
    mesh(box.id, box.sourceEntityId, geo, design.defaults.leaf);
  }
  return meshes;
}

export function reconstructionMaterials(design: Reconstruction) {
  return Object.fromEntries(Object.entries(design.materials).map(([key, value]) => {
    const texture = value.textureId ? surfaceMaterial(value.textureId) : undefined;
    if (value.textureId && !texture) throw new Error(`Textura desconocida: ${value.textureId}`);
    return [key, { ...value, maps: texture?.maps }];
  }));
}
