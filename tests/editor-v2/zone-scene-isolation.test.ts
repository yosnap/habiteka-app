import { describe, expect, it, vi } from 'vitest';
import { CanvasTexture, Color, PerspectiveCamera, Vector4, Scene, Mesh, BoxGeometry, MeshBasicMaterial, Group, ShaderMaterial, type WebGLRenderer, type WebGLProgramParametersWithUniforms } from 'three';
import { clipShaderToZone, isolateSceneToZone } from '@/components/editor-v2/scene/zone-scene-isolation';
import { renderZoneMask } from '@/components/editor-v2/scene/zone-mask';
import { exteriorZoneMarginMm } from '@/components/editor-v2/scene/zone-structural-mask';
import { emptyEditorDocument } from '@/lib/editor-document/schema';

describe('captura de una zona aislada', () => {
  it('calcula el margen según el espesor real del muro y el vuelo de cubierta', () => {
    const doc = emptyEditorDocument();
    doc.walls = [{ id: 'w', startVertexId: 'a', endVertexId: 'b', thicknessMm: 150, dimensionalOrigin: 'physical' }];
    expect(exteriorZoneMarginMm(doc)).toBe(125);
    doc.exteriorRoof = { kind: 'gable', roomIds: [], pitchDeg: 25, orientationDeg: 0, eavesMm: 250, thicknessMm: 160, color: '#555555' };
    expect(exteriorZoneMarginMm(doc)).toBe(375);
  });
  it('la máscara de composición conserva la misma fachada que la captura y restaura materiales', () => {
    const context = { fillRect: vi.fn(), beginPath: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn() };
    vi.stubGlobal('window', { document: { createElement: () => ({ getContext: () => context }) } });
    try {
      const scene = new Scene(), original = new MeshBasicMaterial();
      const wall = new Mesh(new BoxGeometry(), original); wall.userData.cutawayStructural = true;
      const roof = new Mesh(new BoxGeometry(), original); roof.userData.roofLayer = true;
      const floor = new Mesh(new BoxGeometry(), original); scene.add(wall, roof, floor);
      const gl = { domElement: {}, getClearColor: () => new Color(), getClearAlpha: () => 1, setClearColor: vi.fn(),
        render: () => {
          const bounds = (mesh: Mesh) => {
            if (!(mesh.material instanceof ShaderMaterial)) throw new Error('Falta el material de máscara');
            return mesh.material.uniforms.bounds!.value;
          };
          expect(bounds(wall)).toEqual([-.375, -.375, 1.75, 1.75]);
          expect(bounds(roof)).toEqual([-.375, -.375, 1.75, 1.75]);
          expect(bounds(floor)).toEqual([-.05, -.05, 1.1, 1.1]);
        } } as unknown as WebGLRenderer;
      expect(renderZoneMask(gl, scene, new PerspectiveCamera(), [[{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }]], () => 'png', 375)).toBe('png');
      expect(wall.material).toBe(original); expect(roof.material).toBe(original); expect(floor.material).toBe(original);
    } finally { vi.unstubAllGlobals(); }
  });
  it('en el exterior conserva la cara de fachada y el alero sin ampliar el suelo', () => {
    const context = { fillRect: vi.fn(), beginPath: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn() };
    vi.stubGlobal('window', { document: { createElement: () => ({ getContext: () => context }) } });
    try {
      const scene = new Scene(), original = new MeshBasicMaterial();
      const wall = new Mesh(new BoxGeometry(), original); wall.userData.cutawayStructural = true;
      const roof = new Group(); roof.userData.roofLayer = true;
      const roofMesh = new Mesh(new BoxGeometry(), original); roof.add(roofMesh);
      const floor = new Mesh(new BoxGeometry(), original); scene.add(wall, roof, floor);
      const restore = isolateSceneToZone(scene, [[{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }]], false, false, 375);
      const bounds = (mesh: Mesh) => {
        const shader = { uniforms: {}, vertexShader: 'void main() { vec3 transformed = position; #include <project_vertex> }', fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }' } as WebGLProgramParametersWithUniforms;
        (mesh.material as MeshBasicMaterial).onBeforeCompile(shader, {} as never);
        return (shader.uniforms.habitekaZoneBounds!.value as Vector4).toArray();
      };
      expect(bounds(wall)).toEqual([-.375, -.375, 1.75, 1.75]);
      expect(bounds(roofMesh)).toEqual([-.375, -.375, 1.75, 1.75]);
      expect(bounds(floor)).toEqual([-.05, -.05, 1.1, 1.1]);
      restore(); expect(wall.material).toBe(original); expect(roofMesh.material).toBe(original); expect(floor.material).toBe(original);
    } finally { vi.unstubAllGlobals(); }
  });
  it('en vídeo mantiene ortofoto y aleros, recorta suelo y muebles y restaura los originales', () => {
    const context = { fillRect: vi.fn(), beginPath: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn() };
    vi.stubGlobal('window', { document: { createElement: () => ({ getContext: () => context }) } });
    try {
      const scene = new Scene(), material = new MeshBasicMaterial();
      const geo = new Mesh(new BoxGeometry(), material); geo.userData.geographicBackground = true;
      const roof = new Group(); roof.userData.roofLayer = true; const roofMesh = new Mesh(new BoxGeometry(), material); roof.add(roofMesh);
      const floor = new Mesh(new BoxGeometry(), material); floor.userData.videoStage = -1;
      const furniture = new Group(); furniture.userData.videoStage = 3;
      const mesh = new Mesh(new BoxGeometry(), material); mesh.position.set(.5, .5, .5); furniture.add(mesh);
      const outside = new Group(); outside.userData.videoStage = 3;
      const outsideMesh = new Mesh(new BoxGeometry(), material); outsideMesh.position.set(10, 0, 10); outside.add(outsideMesh);
      scene.add(geo, roof, floor, furniture, outside);
      const restore = isolateSceneToZone(scene, [[{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }]], true, true);
      expect(geo.material).toBe(material); expect(roofMesh.material).toBe(material);
      expect(mesh.material).not.toBe(material); expect(floor.visible).toBe(false); expect(outside.visible).toBe(false);
      restore(); expect(mesh.material).toBe(material); expect(floor.visible).toBe(true); expect(outside.visible).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });
  it('descarta antes de pintar y de ocupar profundidad la geometría ajena a la zona', () => {
    const shader = {
      uniforms: {},
      vertexShader: 'void main() { vec3 transformed = position; #include <project_vertex> }',
      fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
    } as WebGLProgramParametersWithUniforms;
    const texture = new CanvasTexture();
    const bounds = new Vector4(0, 0, 4, 4);
    clipShaderToZone(shader, texture, bounds);
    expect(shader.vertexShader).toContain('vHabitekaZoneWorld = (modelMatrix * habitekaZoneLocal).xyz;');
    expect(shader.fragmentShader.indexOf('discard;')).toBeLessThan(shader.fragmentShader.indexOf('gl_FragColor'));
    expect(shader.uniforms.habitekaZoneMap?.value).toBe(texture);
    expect(shader.uniforms.habitekaZoneBounds?.value).toBe(bounds);
  });
});
