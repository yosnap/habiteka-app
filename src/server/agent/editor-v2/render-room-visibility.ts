import { BoxGeometry, BufferAttribute, BufferGeometry, Matrix4, Ray, ShapeUtils, Vector2, Vector3 } from 'three';
import { editorDocumentToScene } from '@/canvas/editor-v2/scene/editor-document-to-scene';
import type { ScenePolygon } from '@/canvas/editor-v2/scene/types';
import { rampPrismGeometry } from '@/canvas/editor-v2/scene/ramp-prism';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderView } from '@/lib/editor-document/render-view';
import { ceilingSurfaces } from '@/lib/editor-document/ceiling-geometry';
import { exteriorRoofGeometry } from '@/lib/editor-document/exterior-roof-geometry';
import { spatialLevels } from './render-spatial-context';

type Triangle = [Vector3, Vector3, Vector3];

/** Triángulos de la misma estructura que muestra la cámara; no necesita WebGL ni llamadas de IA. */
export function renderRoomVisibility(document: EditorDocument, view: RenderView, options: { closeOpenings?: boolean } = {}) {
  const triangles: Triangle[] = [], hidden = new Set(view.cutawayWallIds ?? []);
  const addGeometry = (geometry: BufferGeometry, transform: Matrix4) => {
    const positions = geometry.getAttribute('position'), indices = geometry.getIndex();
    const count = indices?.count ?? positions.count;
    for (let i = 0; i < count; i += 3) triangles.push([0, 1, 2].map(offset =>
      new Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset)
        .applyMatrix4(transform)) as Triangle);
    geometry.dispose();
  };
  const addPolygon = (polygon: ScenePolygon, elevationM: number) => {
    const rings = [polygon.points, ...(polygon.holes ?? [])].map(ring => ring.map(p => new Vector2(p.x, p.y)));
    const indices = ShapeUtils.triangulateShape(rings[0]!, rings.slice(1)), points = rings.flat();
    const bottom = elevationM + polygon.elevation, top = bottom + polygon.height;
    for (const height of polygon.height ? [bottom, top] : [bottom]) for (const face of indices)
      triangles.push(face.map(index => new Vector3(points[index]!.x, height, points[index]!.y)) as Triangle);
    if (polygon.height) for (const ring of rings) ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      const corners = [new Vector3(a.x, bottom, a.y), new Vector3(b.x, bottom, b.y),
        new Vector3(b.x, top, b.y), new Vector3(a.x, top, a.y)];
      triangles.push([corners[0]!, corners[1]!, corners[2]!], [corners[0]!, corners[2]!, corners[3]!]);
    });
  };
  for (const level of spatialLevels(document, view)) {
    // Cerrar solo para esta consulta permite distinguir un punto directo de otro visto a través de un hueco.
    const doc = options.closeOpenings ? { ...level.document, openings: [] } : level.document;
    const elevation = view.allLevels ? level.elevationMm / 1000 : 0;
    const scene = editorDocumentToScene(doc);
    const cutOpenings = new Set(doc.openings.filter(o => hidden.has(o.wallId)).map(o => o.id));
    for (const box of scene.boxes) {
      if (hidden.has(box.sourceEntityId) || cutOpenings.has(box.sourceEntityId) ||
        !['wall', 'frame', 'leaf', 'column', 'step', 'landing'].includes(box.role)) continue;
      const transform = new Matrix4().makeRotationY(box.rotation);
      transform.setPosition(box.position[0], box.position[1] + elevation, box.position[2]);
      addGeometry(new BoxGeometry(...box.size), transform);
    }
    for (const polygon of scene.polygons) {
      if (hidden.has(polygon.sourceEntityId)) continue;
      addPolygon(polygon, elevation);
    }
    for (const ramp of scene.ramps) {
      const part = rampPrismGeometry(ramp.width, ramp.depth, ramp.rise, ramp.baseHeight);
      const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(part.vertices, 3));
      geometry.setIndex(new BufferAttribute(part.indices, 1));
      const transform = new Matrix4().makeRotationY(ramp.rotation);
      transform.setPosition(ramp.position[0], ramp.position[1] + elevation, ramp.position[2]);
      addGeometry(geometry, transform);
    }
    if (view.ceilingView === 'solid') for (const { room, heightMm } of ceilingSurfaces(doc))
      addPolygon({ id: room.id, sourceEntityId: room.id, role: 'floor', color: '',
        points: room.boundary.map(p => ({ x: p.x / 1000, y: p.y / 1000 })), elevation: heightMm / 1000, height: 0 }, elevation);
    if (view.ceilingView !== 'hidden' && !['top', 'isometric', 'drone'].includes(view.preset)) for (const roof of exteriorRoofGeometry(doc)) {
      for (const part of [roof, ...roof.wallClosures.filter(closure => !hidden.has(closure.wallId))]) {
        const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(part.positions, 3));
        geometry.setIndex(new BufferAttribute(part.indices, 1));
        addGeometry(geometry, new Matrix4().makeTranslation(0, elevation, 0));
      }
    }
  }
  const origin = new Vector3(...view.position), ray = new Ray(), hit = new Vector3();
  const depthBeyond = (point: Vector3, afterM = 0) => {
    ray.set(origin, point.clone().sub(origin).normalize());
    let nearest = Infinity;
    for (const triangle of triangles) if (ray.intersectTriangle(...triangle, false, hit)) {
      const distance = origin.distanceTo(hit);
      if (distance > afterM) nearest = Math.min(nearest, distance);
    }
    return nearest;
  };
  return Object.assign((point: Vector3) => {
    const distance = origin.distanceTo(point);
    ray.set(origin, point.clone().sub(origin).normalize());
    return !triangles.some(triangle => ray.intersectTriangle(...triangle, false, hit)
      && origin.distanceTo(hit) < distance - .02);
  }, { depthBeyond });
}
