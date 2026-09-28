import { CanvasTexture, Color, NoColorSpace, ShaderMaterial, type Camera, type Scene, type WebGLRenderer } from 'three';
import type { ZoneMaskRegions } from '@/lib/editor-document/render-view';

/**
 * Margen alrededor de la zona: incluye la cara interior de los muros que la
 * delimitan sin alcanzar la cara opuesta de un tabique (≥ 7 cm).
 */
export const ZONE_MASK_MARGIN_MM = 50;
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
export function drawZoneMap(regions: ZoneMaskRegions, layout: ZoneMapLayout): HTMLCanvasElement {
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
  context.lineWidth = ZONE_MASK_MARGIN_MM * 2 * scale;
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
 * Cada píxel visible es blanco si su posición en planta cae dentro de una zona.
 * Fuera de la zona se descarta el fragmento antes de escribir en profundidad.
 * Así la misma geometría que aparece en el render queda blanca en la máscara.
 */
function zoneMaskMaterial(texture: CanvasTexture, layout: ZoneMapLayout) {
  return new ShaderMaterial({
    // Respeta los cortes de la captura: lo recortado en la foto no entra en la máscara.
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
        vec2 uv = (vWorld.xz - bounds.xy) / bounds.zw;
        float inside = any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0))) ? 0.0 : texture2D(zoneMap, uv).r;
        if (inside < 0.5) discard;
        gl_FragColor = vec4(1.0);
      }`,
  });
}

/**
 * Dibuja la máscara de zonas desde la cámara actual y la devuelve codificada.
 * Restaura material, fondo y color de borrado aunque falle.
 */
export function renderZoneMask(gl: WebGLRenderer, scene: Scene, camera: Camera, regions: ZoneMaskRegions,
  encode: (canvas: HTMLCanvasElement) => string): string | undefined {
  const layout = zoneMapLayout(regions);
  if (!layout) return undefined;
  const texture = new CanvasTexture(drawZoneMap(regions, layout));
  texture.flipY = false;
  texture.colorSpace = NoColorSpace;
  const material = zoneMaskMaterial(texture, layout);
  const background = scene.background, override = scene.overrideMaterial;
  const clearColor = gl.getClearColor(new Color()), clearAlpha = gl.getClearAlpha();
  try {
    scene.background = null;
    scene.overrideMaterial = material;
    gl.setClearColor(0x000000, 1);
    gl.render(scene, camera);
    return encode(gl.domElement);
  } finally {
    scene.background = background;
    scene.overrideMaterial = override;
    gl.setClearColor(clearColor, clearAlpha);
    material.dispose();
    texture.dispose();
  }
}
