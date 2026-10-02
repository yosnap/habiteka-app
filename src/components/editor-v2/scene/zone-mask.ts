import { CanvasTexture, Color, Mesh, NoColorSpace, ShaderMaterial, type Camera, type Material, type Scene, type WebGLRenderer } from 'three';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';
import { belongsToFurnitureGroup, cutawaySupportHeight } from './zone-scene-objects';
import { belongsToZoneStructure } from './zone-structural-mask';

/**
 * Margen alrededor de la zona: incluye la cara interior de los muros que la
 * delimitan sin alcanzar la cara opuesta de un tabique (≥ 7 cm).
 */
export const ZONE_MASK_MARGIN_MM = 50;
/** Solo los zócalos de los muros de borde necesitan incluir su cara exterior. */
export const ZONE_SUPPORT_MARGIN_MM = 200;
const ZONE_MAP_MAX_SIDE_PX = 2048;

export interface ZoneMapLayout { minX: number; minY: number; width: number; height: number }

/** Rectángulo en planta (mm) que cubre todas las zonas con su margen. */
export function zoneMapLayout(regions: ZoneMaskRegions, marginMm = ZONE_MASK_MARGIN_MM): ZoneMapLayout | null {
  const points = regions.flat();
  if (!points.length) return null;
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - marginMm, minY = Math.min(...ys) - marginMm;
  return { minX, minY, width: Math.max(1, Math.max(...xs) + marginMm - minX), height: Math.max(1, Math.max(...ys) + marginMm - minY) };
}

/** Mapa cenital de las zonas: blanco dentro (con margen), negro fuera. */
export function drawZoneMap(regions: ZoneMaskRegions, layout: ZoneMapLayout,
  marginMm = ZONE_MASK_MARGIN_MM): HTMLCanvasElement {
  const scale = ZONE_MAP_MAX_SIDE_PX / Math.max(layout.width, layout.height);
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(layout.width * scale));
  canvas.height = Math.max(1, Math.round(layout.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la máscara de zonas.');
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = context.strokeStyle = '#fff';
  context.lineJoin = 'round';
  context.lineWidth = marginMm * 2 * scale;
  for (const polygon of regions) {
    context.beginPath();
    polygon.forEach((point, index) => {
      const x = (point.x - layout.minX) * scale, y = (point.y - layout.minY) * scale;
      if (index) context.lineTo(x, y); else context.moveTo(x, y);
    });
    context.closePath();
    context.fill();
    context.stroke();
  }
  return canvas;
}

/**
 * La estructura se recorta por la zona; los muebles elegidos conservan su silueta.
 * La máscara debe reproducir exactamente lo que dibuja la captura de referencia.
 */
function zoneMaskMaterial(texture: CanvasTexture, layout: ZoneMapLayout, clipToZone = true,
  supportHeightM?: number) {
  const zoneDiscard = clipToZone
    ? 'vec2 uv = (vWorld.xz - bounds.xy) / bounds.zw;\n' +
      'float inside = any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0))) ? 0.0 : texture2D(zoneMap, uv).r;\n' +
      'if (inside < 0.5) discard;'
    : '';
  return new ShaderMaterial({
    // Respeta los planos de recorte de la cámara.
    clipping: true,
    uniforms: {
      zoneMap: { value: texture },
      // Plano en mm (x, y) → mundo en metros (x, z).
      bounds: { value: [layout.minX / 1000, layout.minY / 1000, layout.width / 1000, layout.height / 1000] },
    },
    vertexShader: `
      #include <clipping_planes_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 local = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
        #endif
        vec4 world = modelMatrix * local;
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: `
      #include <clipping_planes_pars_fragment>
      uniform sampler2D zoneMap;
      uniform vec4 bounds;
      varying vec3 vWorld;
      void main() {
        #include <clipping_planes_fragment>
        ${zoneDiscard}
        ${supportHeightM === undefined ? '' : `if (vWorld.y > ${supportHeightM.toFixed(6)}) discard;`}
        gl_FragColor = vec4(1.0);
      }`,
  });
}

/**
 * Dibuja la máscara de zonas desde la cámara actual y la devuelve codificada.
 * Restaura material, fondo y color de borrado aunque falle.
 */
export function renderZoneMask(gl: WebGLRenderer, scene: Scene, camera: Camera, regions: ZoneMaskRegions,
  encode: (canvas: HTMLCanvasElement) => string, structuralMarginMm?: number): string | undefined {
  const layout = zoneMapLayout(regions);
  if (!layout) return undefined;
  const texture = new CanvasTexture(drawZoneMap(regions, layout));
  texture.flipY = false;
  texture.colorSpace = NoColorSpace;
  const supportLayout = zoneMapLayout(regions, ZONE_SUPPORT_MARGIN_MM)!;
  const supportTexture = new CanvasTexture(drawZoneMap(regions, supportLayout, ZONE_SUPPORT_MARGIN_MM));
  supportTexture.flipY = false;
  supportTexture.colorSpace = NoColorSpace;
  const material = zoneMaskMaterial(texture, layout);
  const furnitureMaterial = zoneMaskMaterial(texture, layout, false);
  const structuralLayout = structuralMarginMm === undefined ? null : zoneMapLayout(regions, structuralMarginMm);
  const structuralTexture = structuralLayout ? new CanvasTexture(drawZoneMap(regions, structuralLayout, structuralMarginMm)) : null;
  if (structuralTexture) { structuralTexture.flipY = false; structuralTexture.colorSpace = NoColorSpace; }
  const structuralMaterial = structuralTexture && structuralLayout ? zoneMaskMaterial(structuralTexture, structuralLayout) : null;
  const supportMaterials = new Map<number, ShaderMaterial>();
  const background = scene.background, override = scene.overrideMaterial;
  const clearColor = gl.getClearColor(new Color()), clearAlpha = gl.getClearAlpha();
  const changed: { mesh: Mesh; material: Material | Material[] }[] = [];
  try {
    scene.background = null;
    scene.overrideMaterial = null;
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      changed.push({ mesh: object, material: object.material });
      const supportHeightM = cutawaySupportHeight(object);
      if (supportHeightM !== undefined && !supportMaterials.has(supportHeightM))
        supportMaterials.set(supportHeightM, zoneMaskMaterial(supportTexture, supportLayout, true, supportHeightM));
      object.material = supportHeightM !== undefined ? supportMaterials.get(supportHeightM)!
        : belongsToFurnitureGroup(object) ? furnitureMaterial
          : structuralMaterial && belongsToZoneStructure(object) ? structuralMaterial : material;
    });
    gl.setClearColor(0x000000, 1);
    gl.render(scene, camera);
    return encode(gl.domElement);
  } finally {
    changed.forEach(({ mesh, material: previous }) => { mesh.material = previous; });
    scene.background = background;
    scene.overrideMaterial = override;
    gl.setClearColor(clearColor, clearAlpha);
    material.dispose();
    furnitureMaterial.dispose();
    structuralMaterial?.dispose();
    structuralTexture?.dispose();
    supportMaterials.forEach((item) => item.dispose());
    supportTexture.dispose();
    texture.dispose();
  }
}
