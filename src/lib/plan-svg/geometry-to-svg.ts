/**
 * Renderer principal del plano técnico: proyecta un `Plano2dPayload` (mm) a un
 * SVG con aspecto de plano de arquitectura — muros macizos (poché), puertas con
 * arco de barrido, ventanas de triple línea, cotas y etiquetas de estancia con
 * superficie.
 *
 * 100 % determinista y puro: mismo payload → mismo SVG. Isomorfo: lo usa el
 * cliente para previsualizar y el servidor para rasterizar (F3). El SVG trabaja
 * en el propio espacio métrico del plano (1 unidad = 1 mm) vía viewBox; los
 * atributos width/height fijan la resolución de salida.
 */
import type { PlanAperture, PlanWall, PlanZone, Plano2dPayload } from '@/lib/contracts';
import {
  apertureGap,
  doorSymbol,
  jambLines,
  openingSymbol,
  windowSymbol,
} from './architectural-symbols';
import { dimensionLine } from './dimension-lines';
import { DEFAULT_PLAN_SVG_THEME, type PlanSvgTheme } from './plan-svg-theme';
import {
  add,
  centroid,
  direction,
  escapeXml,
  fmt,
  fmtPt,
  lerp,
  normal,
  polygonArea,
  type Pt,
} from './svg-geometry';

export interface PlanSvgOptions {
  /** Resolución de salida: píxeles por metro de plano. */
  pxPerMeter?: number;
  theme?: Partial<PlanSvgTheme>;
  showDimensions?: boolean;
  showLabels?: boolean;
}

const DEFAULT_PX_PER_METER = 60;

/** Proyecta el plano a un documento SVG completo (string). */
export function planoToSvg(plano: Plano2dPayload, options: PlanSvgOptions = {}): string {
  const theme = { ...DEFAULT_PLAN_SVG_THEME, ...options.theme };
  const pxPerMeter = options.pxPerMeter ?? DEFAULT_PX_PER_METER;
  const showDimensions = options.showDimensions ?? true;
  const showLabels = options.showLabels ?? true;

  const walls = plano.zones.flatMap((z) => z.walls);
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const bounds = planBounds(plano);
  // Referencia "interior" del plano para decidir lados: cotas hacia fuera,
  // barrido de puertas hacia dentro.
  const planCenter = centroid(walls.flatMap((w) => [w.from, w.to]));

  const layers: string[] = [];

  // 1. Suelos de estancia (bajo los muros).
  for (const zone of plano.zones) {
    if (zone.outline.length >= 3) {
      layers.push(`<polygon points="${zone.outline.map(fmtPt).join(' ')}" fill="${theme.floorFill}"/>`);
    }
  }

  // 2. Muros macizos.
  for (const wall of walls) layers.push(wallPolygon(wall, theme));

  // 3. Aberturas: hueco sobre el poché + simbología.
  for (const zone of plano.zones) {
    for (const ap of zone.apertures) {
      const wall = wallById.get(ap.wallId);
      if (wall) layers.push(renderAperture(ap, wall, planCenter, theme));
    }
  }

  // 4. Cotas, desplazadas hacia el exterior del plano.
  if (showDimensions) {
    for (const zone of plano.zones) {
      for (const dim of zone.dimensions) {
        const dir = direction(dim.from, dim.to);
        if (!dir) continue;
        const n = normal(dir);
        const mid = lerp(dim.from, dim.to, 0.5);
        const toCenter = { x: planCenter.x - mid.x, y: planCenter.y - mid.y };
        const outwardSign: 1 | -1 = toCenter.x * n.x + toCenter.y * n.y > 0 ? -1 : 1;
        layers.push(dimensionLine(dim, outwardSign, theme));
      }
    }
  }

  // 5. Etiquetas de estancia: nombre + superficie.
  if (showLabels) {
    for (const zone of plano.zones) layers.push(zoneLabel(zone, theme));
  }

  const minX = bounds.minX - theme.paddingMm;
  const minY = bounds.minY - theme.paddingMm;
  const w = bounds.maxX - bounds.minX + theme.paddingMm * 2;
  const h = bounds.maxY - bounds.minY + theme.paddingMm * 2;
  const pxW = Math.max(1, Math.round((w / 1000) * pxPerMeter));
  const pxH = Math.max(1, Math.round((h / 1000) * pxPerMeter));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" viewBox="${fmt(minX)} ${fmt(minY)} ${fmt(w)} ${fmt(h)}">`,
    `<rect x="${fmt(minX)}" y="${fmt(minY)}" width="${fmt(w)}" height="${fmt(h)}" fill="${theme.background}"/>`,
    ...layers,
    '</svg>',
  ].join('');
}

/** Polígono macizo del muro: el segmento eje expandido medio grosor a cada lado. */
function wallPolygon(wall: PlanWall, theme: PlanSvgTheme): string {
  const dir = direction(wall.from, wall.to);
  if (!dir) return '';
  const n = normal(dir);
  const half = wall.thicknessMm / 2;
  const corners = [
    add(wall.from, n, half),
    add(wall.to, n, half),
    add(wall.to, n, -half),
    add(wall.from, n, -half),
  ];
  return `<polygon points="${corners.map(fmtPt).join(' ')}" fill="${theme.wallFill}"/>`;
}

/** Hueco + símbolo de una abertura sobre su muro. */
function renderAperture(ap: PlanAperture, wall: PlanWall, planCenter: Pt, theme: PlanSvgTheme): string {
  const dir = direction(wall.from, wall.to);
  if (!dir) return '';
  const n = normal(dir);
  const center = lerp(wall.from, wall.to, ap.position);
  const halfW = ap.widthMm / 2;
  const a = add(center, dir, -halfW);
  const b = add(center, dir, halfW);

  const parts = [apertureGap(a, b, n, wall.thicknessMm, theme.background)];
  if (ap.kind === 'puerta') {
    // La hoja barre hacia el interior del plano (convención habitual).
    const toCenter = { x: planCenter.x - center.x, y: planCenter.y - center.y };
    const inward = toCenter.x * n.x + toCenter.y * n.y >= 0 ? n : { x: -n.x, y: -n.y };
    parts.push(jambLines(a, b, n, wall.thicknessMm, theme));
    parts.push(doorSymbol(a, b, inward, theme));
  } else if (ap.kind === 'ventana') {
    parts.push(windowSymbol(a, b, n, wall.thicknessMm, theme));
  } else {
    parts.push(jambLines(a, b, n, wall.thicknessMm, theme));
    parts.push(openingSymbol(a, b, theme));
  }
  return parts.join('');
}

/** Nombre de la estancia y su superficie, centrados en el contorno. */
function zoneLabel(zone: PlanZone, theme: PlanSvgTheme): string {
  if (zone.outline.length < 3) return '';
  const c = centroid(zone.outline);
  const areaM2 = polygonArea(zone.outline) / 1_000_000;
  const name = `<text x="${fmt(c.x)}" y="${fmt(c.y)}" text-anchor="middle" font-family="${theme.fontFamily}" font-size="${theme.labelFontMm}" font-weight="600" fill="${theme.textColor}">${escapeXml(zone.name)}</text>`;
  const area = `<text x="${fmt(c.x)}" y="${fmt(c.y + theme.areaFontMm * 1.4)}" text-anchor="middle" font-family="${theme.fontFamily}" font-size="${theme.areaFontMm}" fill="${theme.textColor}">${areaM2.toFixed(2).replace('.', ',')} m²</text>`;
  return name + area;
}

/** Bounding box del plano: muros (con su grosor) y contornos de estancia. */
function planBounds(plano: Plano2dPayload) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (p: Pt, margin = 0) => {
    minX = Math.min(minX, p.x - margin);
    minY = Math.min(minY, p.y - margin);
    maxX = Math.max(maxX, p.x + margin);
    maxY = Math.max(maxY, p.y + margin);
  };
  for (const zone of plano.zones) {
    for (const w of zone.walls) {
      grow(w.from, w.thicknessMm / 2);
      grow(w.to, w.thicknessMm / 2);
    }
    for (const p of zone.outline) grow(p);
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  return { minX, minY, maxX, maxY };
}
