/** Segunda lectura breve: símbolos pequeños que el JSON global suele omitir. */
import type { ChatVisionAdapter, JsonSchema, MessagePart } from '@/lib/contracts';
import type { RawSketch, SketchAperture, SketchPoint, SketchWall } from './sketch-types';
import { validDoorArcGeometry } from './door-arc-geometry';
import sharp from 'sharp';

const POINT: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['x', 'y'],
  properties: { x: { type: 'number' }, y: { type: 'number' } },
};

const SYMBOL_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['doors', 'windows'],
  properties: {
    doors: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['hinge', 'openingEnd', 'arcPoint'],
      properties: { hinge: POINT, openingEnd: POINT, arcPoint: POINT },
    } },
    windows: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['start', 'end'], properties: { start: POINT, end: POINT },
    } },
  },
};

const PROMPT = [
  'Inspecciona EXCLUSIVAMENTE los símbolos de puertas y ventanas de este plano.',
  'Recorre toda la imagen de arriba abajo y de izquierda a derecha. No dibujes muros ni estancias.',
  'Coordenadas x,y normalizadas 0–1 respecto a la imagen completa.',
  'doors: una entrada por cada arco curvo de barrido visible. hinge es el centro del arco',
  'sobre el muro; openingEnd es el otro extremo del vano sobre ESE muro; arcPoint es un',
  'punto real de la curva, separado del muro. Sigue la curva original: no inviertas el arco.',
  'Ignora arcos de mobiliario, sanitarios, textos y huecos sin curva de barrido.',
  'windows: una entrada por cada ventana visible; start y end son los extremos de la',
  'banda de vidrio sobre su muro, incluidas las ventanas altas interiores.',
  'No incluyas puertas ni dibujos de armarios. Separa ventanas con un pilar entre ellas.',
  'Incluye también símbolos pequeños y los del borde inferior de la planta.',
  'No inventes símbolos. Si dudas de un símbolo, omítelo.',
].join('\n');

const FOCUSED_PROMPT = [
  'Analiza este RECORTE de un plano arquitectónico.',
  'Devuelve cada arco de puerta visible con tres puntos EXACTOS en coordenadas x,y',
  'de 0 a 1 RELATIVAS AL RECORTE: hinge es el centro del arco sobre el muro,',
  'openingEnd el otro extremo del vano sobre el MISMO muro y arcPoint un punto de la curva.',
  'Incluye puertas pequeñas del baño y los dormitorios, sin inventar.',
  'Ventanas: cada banda de vidrio, incluidas las ventanas altas de tabiques interiores,',
  'con start y end sobre el muro; no confundas armarios ni muebles.',
  'Si hay dos ventanas separadas por un pilar, pon dos entradas.',
  'Examina cada cuadrícula. No estimes por simetría.',
].join(' ');

const SMALL_ROOM_PROMPT = [
  'Inspecciona el recorte en detalle. Hay varios arcos de puerta próximos junto a',
  'una estancia pequeña y las contiguas; representa TODOS los que realmente veas,',
  'uno por curva. Para cada uno, hinge es el centro de giro del arco sobre el muro,',
  'openingEnd es el extremo opuesto del hueco sobre ese MISMO muro y arcPoint un punto',
  'de la curva. Coordenadas x,y 0..1 respecto a ESTE recorte.',
  'Incluye ventanas altas como segmentos en el muro. No uses bordes de camas,',
  'sanitarios ni armarios como símbolos. Si dudas de un arco, omítelo.',
].join(' ');

function validPoint(value: unknown): value is SketchPoint {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.x === 'number' && typeof p.y === 'number' &&
    Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
}

function nearestWall(start: SketchPoint, end: SketchPoint, walls: SketchWall[]) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const width = Math.hypot(dx, dy);
  if (width < 0.015 || width > 0.25) return null;
  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const choices = walls.flatMap((wall, index) => {
    const wx = wall.x2 - wall.x1;
    const wy = wall.y2 - wall.y1;
    const length = Math.hypot(wx, wy);
    if (!length || Math.abs((dx * wx + dy * wy) / (width * length)) < 0.85) return [];
    const x = center.x - wall.x1, y = center.y - wall.y1;
    const position = (x * wx + y * wy) / (length * length);
    const perpendicular = Math.abs(x * wy - y * wx) / length;
    if (position < -0.05 || position > 1.05 || perpendicular > 0.014) return [];
    return [{ index, position: Math.max(0, Math.min(1, position)), widthRatio: width / length,
      score: perpendicular + Math.max(0, -position, position - 1) * length }];
  });
  return choices.sort((a, b) => a.score - b.score)[0] ?? null;
}

/** Un arco puede ocupar todo el tramo final de una pared que visión dejó cortada. */
function liesOnRoomEdge(start: SketchPoint, end: SketchPoint, raw: RawSketch): boolean {
  const vertical = Math.abs(start.x - end.x) < 0.012;
  const horizontal = Math.abs(start.y - end.y) < 0.012;
  if (vertical === horizontal) return false;
  const continuesWall = raw.muros.some((wall) => {
    const sameAxis = vertical ? Math.abs(wall.x1 - wall.x2) < 0.008 : Math.abs(wall.y1 - wall.y2) < 0.008;
    const distance = vertical ? Math.abs(wall.x1 - start.x) : Math.abs(wall.y1 - start.y);
    if (!sameAxis || distance >= 0.02) return false;
    const endpoints = vertical ? [wall.y1, wall.y2] : [wall.x1, wall.x2];
    const opening = vertical ? [start.y, end.y] : [start.x, end.x];
    return endpoints.some((value) => opening.some((point) => Math.abs(value - point) < 0.025));
  });
  if (!continuesWall) return false;
  return raw.habitaciones.some((room) => room.poligono.some((point, index) => {
    const next = room.poligono[(index + 1) % room.poligono.length]!;
    if (vertical) return Math.abs(point.x - next.x) < 0.008 &&
      Math.abs(point.x - start.x) < 0.02 &&
      Math.min(start.y, end.y) >= Math.min(point.y, next.y) - 0.012 &&
      Math.max(start.y, end.y) <= Math.max(point.y, next.y) + 0.012;
    return Math.abs(point.y - next.y) < 0.008 &&
      Math.abs(point.y - start.y) < 0.02 &&
      Math.min(start.x, end.x) >= Math.min(point.x, next.x) - 0.012 &&
      Math.max(start.x, end.x) <= Math.max(point.x, next.x) + 0.012;
  }));
}

function apertureCenter(aperture: SketchAperture, walls: SketchWall[]): SketchPoint | null {
  if (aperture.arcGeometry) {
    const { hinge, openingEnd } = aperture.arcGeometry;
    return { x: (hinge.x + openingEnd.x) / 2, y: (hinge.y + openingEnd.y) / 2 };
  }
  const wall = walls[aperture.muro];
  return wall ? { x: wall.x1 + (wall.x2 - wall.x1) * aperture.posicion,
    y: wall.y1 + (wall.y2 - wall.y1) * aperture.posicion } : null;
}

interface ImageCrop { left: number; top: number; width: number; height: number }

/** La segunda lectura amplía el centro, donde suelen concentrarse puertas y tabiques. */
function focusedCrop(width: number, height: number): ImageCrop {
  const left = Math.round(width * 0.18);
  const top = Math.round(height * 0.17);
  return { left, top, width: Math.round(width * 0.64), height: Math.round(height * 0.66) };
}

/** Un segundo acercamiento resuelve puertas enfrentadas en torno a la estancia menor. */
function smallRoomCrop(raw: RawSketch, width: number, height: number): ImageCrop | null {
  const rooms = raw.habitaciones.filter((room) => room.exterior !== true && room.poligono.length >= 3);
  if (rooms.length < 4) return null;
  const box = (points: SketchPoint[]) => ({
    minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)),
  });
  const smallest = rooms.map((room) => ({ room, box: box(room.poligono) }))
    .filter(({ box: b }) => (b.maxX - b.minX) * (b.maxY - b.minY) >= 0.004)
    .sort((a, b) =>
      (a.box.maxX - a.box.minX) * (a.box.maxY - a.box.minY) -
      (b.box.maxX - b.box.minX) * (b.box.maxY - b.box.minY))[0];
  if (!smallest) return null;
  const b = smallest.box;
  if ((b.maxX - b.minX) * (b.maxY - b.minY) > 0.045) return null;
  const overall = box(rooms.flatMap((room) => room.poligono));
  const cx = ((b.minX + b.maxX) / 2) * 0.7 + ((overall.minX + overall.maxX) / 2) * 0.3;
  const cy = ((b.minY + b.maxY) / 2) * 0.7 + ((overall.minY + overall.maxY) / 2) * 0.3;
  const fractionW = Math.min(0.7, Math.max(0.48, (b.maxX - b.minX) * 1.7));
  const fractionH = Math.min(0.65, Math.max(0.34, (b.maxY - b.minY) * 3.5));
  const left = Math.round(Math.max(0, Math.min(1 - fractionW, cx - fractionW / 2)) * width);
  const top = Math.round(Math.max(0, Math.min(1 - fractionH, cy - fractionH / 2)) * height);
  return { left, top, width: Math.round(fractionW * width), height: Math.round(fractionH * height) };
}

function remapFocusedSymbols(value: unknown, crop: ImageCrop, width: number, height: number): unknown {
  if (!value || typeof value !== 'object') return value;
  const symbols = value as Record<string, unknown>;
  const point = (candidate: unknown): SketchPoint | null => {
    if (!validPoint(candidate)) return null;
    return { x: (crop.left + candidate.x * crop.width) / width,
      y: (crop.top + candidate.y * crop.height) / height };
  };
  const doors = (Array.isArray(symbols.doors) ? symbols.doors : []).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const arc = item as Record<string, unknown>;
    const hinge = point(arc.hinge), openingEnd = point(arc.openingEnd), arcPoint = point(arc.arcPoint);
    return hinge && openingEnd && arcPoint ? [{ hinge, openingEnd, arcPoint }] : [];
  });
  const windows = (Array.isArray(symbols.windows) ? symbols.windows : []).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const window = item as Record<string, unknown>;
    const start = point(window.start), end = point(window.end);
    return start && end ? [{ start, end }] : [];
  });
  return { doors, windows };
}

function preferFocusedSymbols(raw: RawSketch, focused: unknown, aspect: number): RawSketch {
  if (!focused || typeof focused !== 'object') return raw;
  const symbols = focused as Record<string, unknown>;
  const centers = (Array.isArray(symbols.doors) ? symbols.doors : []).flatMap((item) => {
    const arc = validDoorArcGeometry(item, aspect);
    return arc ? [{ x: (arc.hinge.x + arc.openingEnd.x) / 2,
      y: (arc.hinge.y + arc.openingEnd.y) / 2 }] : [];
  });
  const focusedWindows = (Array.isArray(symbols.windows) ? symbols.windows : []).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { start, end } = item as Record<string, unknown>;
    if (!validPoint(start) || !validPoint(end)) return [];
    const wall = nearestWall(start, end, raw.muros);
    return wall ? [{ wall: wall.index, start, end }] : [];
  });
  return { ...raw, aberturas: raw.aberturas.filter((item) => {
    if (item.tipo === 'puerta' && item.arcGeometry) {
      const center = apertureCenter(item, raw.muros);
      return !center || !centers.some((focusedCenter) =>
        Math.hypot(center.x - focusedCenter.x, center.y - focusedCenter.y) < 0.065);
    }
    if (item.tipo !== 'ventana') return true;
    const wall = raw.muros[item.muro];
    if (!wall || !item.anchoSobreMuro) return true;
    const center = apertureCenter(item, raw.muros)!;
    const dx = (wall.x2 - wall.x1) * item.anchoSobreMuro / 2;
    const dy = (wall.y2 - wall.y1) * item.anchoSobreMuro / 2;
    const oldStart = { x: center.x - dx, y: center.y - dy };
    const oldEnd = { x: center.x + dx, y: center.y + dy };
    const oldWidth = Math.hypot(oldEnd.x - oldStart.x, oldEnd.y - oldStart.y);
    return !focusedWindows.some((window) => {
      if (window.wall !== item.muro) return false;
      const width = Math.hypot(window.end.x - window.start.x, window.end.y - window.start.y);
      if (width > oldWidth * 0.8) return false;
      const projected = [window.start, window.end].map((p) =>
        ((p.x - oldStart.x) * (oldEnd.x - oldStart.x) +
          (p.y - oldStart.y) * (oldEnd.y - oldStart.y)) / (oldWidth * oldWidth));
      return projected.every((t) => t >= -0.05 && t <= 1.05);
    });
  }) };
}

/** Une símbolos observados en una lectura focal con la lectura de estancias y muros. */
export function mergePlanSymbols(
  raw: RawSketch, structured: unknown,
  options: { imageHeightOverWidth?: number } = {},
): RawSketch {
  if (!structured || typeof structured !== 'object') return raw;
  const symbols = structured as Record<string, unknown>;
  const additions: SketchAperture[] = [];
  const virtualWalls: SketchWall[] = [];
  for (const item of Array.isArray(symbols.doors) ? symbols.doors : []) {
    const arc = validDoorArcGeometry(item, options.imageHeightOverWidth);
    if (!arc) continue;
    let wall = nearestWall(arc.hinge, arc.openingEnd, raw.muros);
    if (!wall && liesOnRoomEdge(arc.hinge, arc.openingEnd, raw)) {
      const index = raw.muros.length + virtualWalls.length;
      virtualWalls.push({ x1: arc.hinge.x, y1: arc.hinge.y,
        x2: arc.openingEnd.x, y2: arc.openingEnd.y });
      wall = { index, position: 0.5, widthRatio: 1, score: 0 };
    }
    if (!wall) continue;
    additions.push({ tipo: 'puerta', muro: wall.index, posicion: wall.position,
      anchoSobreMuro: wall.widthRatio, arcVisible: true, arcGeometry: arc });
  }
  for (const item of Array.isArray(symbols.windows) ? symbols.windows : []) {
    if (!item || typeof item !== 'object') continue;
    const { start, end } = item as Record<string, unknown>;
    if (!validPoint(start) || !validPoint(end)) continue;
    const wall = nearestWall(start, end, raw.muros);
    if (!wall) continue;
    additions.push({ tipo: 'ventana', muro: wall.index, posicion: wall.position,
      anchoSobreMuro: wall.widthRatio });
  }
  if (!additions.length) return raw;
  const walls = [...raw.muros, ...virtualWalls];
  const aberturas = [...raw.aberturas];
  for (const addition of additions) {
    const center = apertureCenter(addition, walls)!;
    const same = aberturas.findIndex((item) => {
      if (item.tipo !== addition.tipo) return false;
      const current = apertureCenter(item, walls);
      if (!current || Math.hypot(current.x - center.x, current.y - center.y) >= 0.022) return false;
      if (item.tipo !== 'puerta' || !item.arcGeometry || !addition.arcGeometry) return true;
      const a = item.arcGeometry, b = addition.arcGeometry;
      const adx = a.openingEnd.x - a.hinge.x, ady = a.openingEnd.y - a.hinge.y;
      const bdx = b.openingEnd.x - b.hinge.x, bdy = b.openingEnd.y - b.hinge.y;
      return Math.abs((adx * bdx + ady * bdy) / (Math.hypot(adx, ady) * Math.hypot(bdx, bdy))) > 0.9;
    });
    if (same >= 0) aberturas[same] = addition;
    else aberturas.push(addition);
  }
  return { ...raw, muros: walls, aberturas };
}

/** Relectura focal de símbolos para todos los planos con varias estancias. */
export function needsSymbolPass(raw: RawSketch): boolean { return raw.habitaciones.length >= 4; }

export async function extractPlanSymbols(
  chat: ChatVisionAdapter, imageParts: MessagePart[], raw: RawSketch,
): Promise<RawSketch> {
  const source = imageParts.find((part): part is Extract<MessagePart, { type: 'image_url' }> =>
    part.type === 'image_url');
  const dimensions = source?.base64
    ? await sharp(Buffer.from(source.base64, 'base64')).metadata().catch(() => null) : null;
  const result = await chat.chat({ model: '', messages: [{ role: 'user', content: [
    { type: 'text', text: PROMPT }, ...imageParts,
  ] }], responseSchema: SYMBOL_SCHEMA, maxTokens: 4096 });
  const aspect = dimensions?.width && dimensions.height ? dimensions.height / dimensions.width : 1;
  const full = mergePlanSymbols(raw, result.structured, { imageHeightOverWidth: aspect });
  if (!source?.base64 || !dimensions?.width || !dimensions.height ||
    dimensions.width < 500 || dimensions.height < 700) return full;
  let merged = full;
  const crops = [
    { crop: focusedCrop(dimensions.width, dimensions.height), prompt: FOCUSED_PROMPT },
    { crop: smallRoomCrop(raw, dimensions.width, dimensions.height), prompt: SMALL_ROOM_PROMPT },
  ];
  for (const { crop, prompt } of crops) {
    if (!crop) continue;
    try {
      const cropped = await sharp(Buffer.from(source.base64, 'base64')).extract(crop).png().toBuffer();
      const focused = await chat.chat({ model: '', messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', base64: cropped.toString('base64'), mimeType: 'image/png' },
      ] }], responseSchema: SYMBOL_SCHEMA, maxTokens: 4096 });
      const mapped = remapFocusedSymbols(focused.structured, crop, dimensions.width, dimensions.height);
      merged = mergePlanSymbols(preferFocusedSymbols(merged, mapped, aspect), mapped,
        { imageHeightOverWidth: aspect });
    } catch {
      // Una lectura focal fallida no descarta los símbolos anteriores.
    }
  }
  return merged;
}
