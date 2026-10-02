import { CanvasTexture, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Sprite, SpriteMaterial, Vector3, type Object3D } from 'three';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { videoDimensionAnchors } from './video-dimensions';
import { dimensionReveal, videoDimensionMode, type VideoPresentationOptions } from '@/lib/editor-document/video-presentation';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';

/** Cotas en espacio 3D: el búfer de profundidad las oculta detrás de la casa sin raycasts por fotograma. */
export function createVideoDimensionOverlay(scene: Object3D, doc: EditorDocument, camera: PerspectiveCamera, regions: ZoneMaskRegions = []) {
  const root = new Group(); root.name = 'video-dimensions';
  const geometry = new CylinderGeometry(1, 1, 1, 6);
  const up = new Vector3(0, 1, 0), direction = new Vector3(), end = new Vector3();
  const items = videoDimensionAnchors(doc, regions).filter(line => line.value > .001).map(anchor => {
    const group = new Group(), material = new MeshBasicMaterial({ color: '#38bdf8', transparent: true, depthWrite: false });
    const body = new Mesh(geometry, material), ticks = [new Mesh(geometry, material), new Mesh(geometry, material)];
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 72;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudieron preparar las etiquetas de cotas.');
    const text = `${anchor.value.toLocaleString('es-ES', { maximumFractionDigits: 2 })} m`;
    context.font = '36px sans-serif'; context.textAlign = 'center';
    const textWidth = context.measureText(text).width + 26;
    context.fillStyle = '#142720e6'; context.fillRect((320 - textWidth) / 2, 6, textWidth, 60);
    context.fillStyle = '#e0f2fe'; context.fillText(text, 160, 49);
    const texture = new CanvasTexture(canvas), label = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    label.position.copy(anchor.start).lerp(anchor.end, .5); label.position.y += .035;
    group.add(body, ...ticks, label); root.add(group);
    return { anchor, group, material, body, ticks, texture, label };
  });
  scene.add(root);
  function segment(mesh: Mesh, start: Vector3, finish: Vector3, radius: number) {
    direction.copy(finish).sub(start); mesh.position.copy(start).add(finish).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(up, direction.clone().normalize()); mesh.scale.set(radius, direction.length(), radius);
  }
  return {
    root,
    update(elapsedMs: number, options: VideoPresentationOptions, outputHeight = 1080) {
      const mode = videoDimensionMode(options), depthTest = options.dimensionOcclusion !== false;
      items.forEach((item, index) => {
        const { progress, opacity } = dimensionReveal(mode, elapsedMs, index);
        item.group.visible = progress > 0 && opacity > 0;
        if (!item.group.visible) return;
        if (item.material.depthTest !== depthTest) { item.material.depthTest = depthTest; item.material.needsUpdate = true; }
        if (item.label.material.depthTest !== depthTest) { item.label.material.depthTest = depthTest; item.label.material.needsUpdate = true; }
        item.material.opacity = opacity; item.label.material.opacity = opacity;
        // Tamaño aparente estable al mover la cámara, sin depender del viewport del navegador.
        const pixelM = 2 * camera.position.distanceTo(item.label.position) * Math.tan(camera.fov * Math.PI / 360) / outputHeight;
        const radius = pixelM * 1.2;
        end.copy(item.anchor.start).lerp(item.anchor.end, progress); segment(item.body, item.anchor.start, end, radius);
        const tickDirection = item.anchor.start.y !== item.anchor.end.y ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
        [item.anchor.start, end].forEach((point, tick) => {
          segment(item.ticks[tick]!, point.clone().addScaledVector(tickDirection, -pixelM * 7), point.clone().addScaledVector(tickDirection, pixelM * 7), radius);
        });
        item.label.visible = progress === 1;
        item.label.scale.set(pixelM * 213, pixelM * 48, 1);
      });
    },
    dispose() {
      scene.remove(root); geometry.dispose();
      items.forEach(item => { item.material.dispose(); item.label.material.dispose(); item.texture.dispose(); });
    },
  };
}
